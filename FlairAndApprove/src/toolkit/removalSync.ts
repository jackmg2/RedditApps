// Copied from _shared/toolkit — do not edit in the app.
// Edit c:\Dev\02_RedditApps\_shared\toolkit and run: node ../_shared/sync-toolkit.mjs sync --all
//
// Rule 1: when a moderator removes content this app created, the app must
// clean up its own state (and by default author-delete the content so it
// cannot be re-approved). Framework-agnostic: handlers take the parsed
// trigger payload and return a TriggerResponse-compatible object, so both
// the Hono apps and the raw-node apps wire them with one line of glue.
//
// devvit.json wiring (any subset):
//   "triggers": {
//     "onModAction":     "/internal/triggers/on-mod-action",
//     "onPostDelete":    "/internal/triggers/on-post-delete",
//     "onCommentDelete": "/internal/triggers/on-comment-delete",
//     "onAppUpgrade":    "/internal/triggers/on-app-upgrade"
//   }

import { context, reddit } from "@devvit/web/server";

export type RemovalEvent = {
  kind: "post" | "comment";
  targetId: string; // t3_ / t1_ id
  action?: string; // mod-action name when source === 'modAction'
  source: "modAction" | "postDelete" | "commentDelete" | "backfill";
};

export type RemovalSyncConfig = {
  /** Is this the app's own content? (contentTracker.isTracked, or a redis
   *  state-key existence check.) Non-app content is ignored. */
  isAppContent: (e: RemovalEvent) => Promise<boolean>;
  /** Delete the app's state for this content (redis keys, registry entry). */
  cleanup: (e: RemovalEvent) => Promise<void>;
  /** Also author-delete the reddit content (cannot be re-approved).
   *  Default true. Not run for postDelete/commentDelete sources (already
   *  deleted). */
  deleteContent?: boolean;
  /** Skip mod actions performed by the app account itself. Default true. */
  ignoreAppOwnActions?: boolean;
  /** Mod actions on posts to mirror. Default ['removelink', 'spamlink']. */
  postActions?: string[];
  /** Mod actions on comments to mirror. Default ['removecomment', 'spamcomment']. */
  commentActions?: string[];
  /** App comment ids under a given post (typically contentTracker's
   *  commentsUnderPost). When set, handlePostDelete also self-deletes those
   *  comments when the post's author deletes the post — the comments are the
   *  app's own, so no mod permission is needed. Mod removals never fire
   *  onPostDelete and are reversible (the post can be re-approved), so they
   *  intentionally do NOT trigger this. */
  commentsUnderPost?: (postId: string) => Promise<string[]>;
};

// Structural payload types: mod-action payloads may arrive flattened or
// wrapped under `modAction`, so we normalize instead of trusting one shape.
type ModActionPayload = {
  action?: string;
  moderator?: { name?: string };
  targetPost?: { id?: string };
  targetComment?: { id?: string };
  modAction?: ModActionPayload;
};

type PostDeletePayload = { postId?: string; source?: number | string };
type CommentDeletePayload = { commentId?: string };

// EventSource.MODERATOR — arrives as the enum number or its string name
// depending on the payload encoding. Defensive only: mod removals fire
// onModAction, not onPostDelete.
function isModeratorSource(source?: number | string): boolean {
  return source === 3 || source === "MODERATOR";
}

type TriggerResult = { status: "success" };

const OK: TriggerResult = { status: "success" };

export type SweepRemovedAppPostsOptions = {
  /** Restrict to this subreddit. Default: context.subredditName. */
  subredditName?: string;
  /** Max app-account posts to inspect (newest first). Default 1000. */
  limit?: number;
  /** Also gate on isAppContent. Default false: within the target subreddit,
   *  author === app account is the app-content criterion, and legacy content
   *  may predate the state keys isAppContent checks. */
  requireAppContent?: boolean;
};

export type RemovalSync = {
  handleModAction(payload: ModActionPayload): Promise<TriggerResult>;
  handlePostDelete(payload: PostDeletePayload): Promise<TriggerResult>;
  handleCommentDelete(payload: CommentDeletePayload): Promise<TriggerResult>;
  /** onAppUpgrade backfill: the live trigger only catches removals going
   *  forward; this sweeps the subreddit mod log for earlier ones. */
  handleAppUpgradeBackfill(subredditName?: string): Promise<TriggerResult>;
  /** Backfill for app-authored posts: sweeps the app account's own posts in
   *  the current subreddit and syncs any that a moderator removed. Catches
   *  what the mod-log backfill misses (log entries past its window, content
   *  with no isAppContent state). Only visits posts authored by the app
   *  account, so user-authored posts are never touched. */
  sweepRemovedAppPosts(options?: SweepRemovedAppPostsOptions): Promise<TriggerResult>;
};

export function createRemovalSync(config: RemovalSyncConfig): RemovalSync {
  const deleteContent = config.deleteContent ?? true;
  const ignoreAppOwnActions = config.ignoreAppOwnActions ?? true;
  const postActions = config.postActions ?? ["removelink", "spamlink"];
  const commentActions = config.commentActions ?? ["removecomment", "spamcomment"];

  async function process(e: RemovalEvent, deletedAlready: boolean): Promise<void> {
    if (!(await config.isAppContent(e))) return;

    if (deleteContent && !deletedAlready) {
      try {
        if (e.kind === "post") {
          const post = await reddit.getPostById(e.targetId as `t3_${string}`);
          await post.delete(); // author-delete — cannot be approved back
        } else {
          const comment = await reddit.getCommentById(e.targetId as `t1_${string}`);
          await comment.delete();
        }
      } catch (err) {
        console.error(`removalSync: content delete failed for ${e.targetId};`, err);
      }
    }

    try {
      await config.cleanup(e);
    } catch (err) {
      console.error(`removalSync: cleanup failed for ${e.targetId};`, err);
    }
  }

  async function isAppOwnAction(payload: ModActionPayload): Promise<boolean> {
    if (!ignoreAppOwnActions) return false;
    try {
      const appUser = await reddit.getAppUser();
      return !!appUser && payload.moderator?.name === appUser.username;
    } catch (err) {
      console.error("removalSync: could not resolve app user;", err);
      return false;
    }
  }

  return {
    async handleModAction(payload) {
      try {
        // Payload may arrive flattened or wrapped under `modAction`.
        const event = payload.modAction ?? payload;
        const action = event.action;
        if (!action) return OK;

        // This trigger fires for every mod action in the subreddit — filter hard.
        let e: RemovalEvent | undefined;
        if (postActions.includes(action) && event.targetPost?.id) {
          e = { kind: "post", targetId: event.targetPost.id, action, source: "modAction" };
        } else if (commentActions.includes(action) && event.targetComment?.id) {
          e = { kind: "comment", targetId: event.targetComment.id, action, source: "modAction" };
        }
        if (!e) return OK;

        if (await isAppOwnAction(event)) return OK;

        await process(e, false);
      } catch (err) {
        console.error("removalSync: handleModAction failed;", err);
      }
      return OK;
    },

    async handlePostDelete(payload) {
      try {
        if (payload.postId) {
          await process(
            { kind: "post", targetId: payload.postId, source: "postDelete" },
            true,
          );

          // Third-party post author-deleted: self-delete the app's comments
          // under it (author deletion is irreversible, unlike a mod removal).
          // No isAppContent gate — the mapping only ever holds app comments.
          if (config.commentsUnderPost && !isModeratorSource(payload.source)) {
            for (const id of await config.commentsUnderPost(payload.postId)) {
              try {
                const comment = await reddit.getCommentById(id as `t1_${string}`);
                await comment.delete();
              } catch (err) {
                console.error(`removalSync: orphaned comment delete failed for ${id};`, err);
              }
              try {
                await config.cleanup({ kind: "comment", targetId: id, source: "postDelete" });
              } catch (err) {
                console.error(`removalSync: cleanup failed for ${id};`, err);
              }
            }
          }
        }
      } catch (err) {
        console.error("removalSync: handlePostDelete failed;", err);
      }
      return OK;
    },

    async handleCommentDelete(payload) {
      try {
        if (payload.commentId) {
          await process(
            { kind: "comment", targetId: payload.commentId, source: "commentDelete" },
            true,
          );
        }
      } catch (err) {
        console.error("removalSync: handleCommentDelete failed;", err);
      }
      return OK;
    },

    async handleAppUpgradeBackfill(subredditName) {
      const subreddit = subredditName ?? context.subredditName;
      if (!subreddit) return OK;

      const seen = new Set<string>();
      const sweeps: Array<{ type: string; kind: RemovalEvent["kind"] }> = [
        ...postActions.map((type) => ({ type, kind: "post" as const })),
        ...commentActions.map((type) => ({ type, kind: "comment" as const })),
      ];

      for (const { type, kind } of sweeps) {
        try {
          const actions = await reddit
            .getModerationLog({
              subredditName: subreddit,
              type: type as NonNullable<Parameters<typeof reddit.getModerationLog>[0]["type"]>,
              limit: 1000,
            })
            .all();
          for (const a of actions) {
            const targetId = a.target?.id;
            if (!targetId || seen.has(targetId)) continue;
            seen.add(targetId);
            await process(
              { kind, targetId, action: type, source: "backfill" },
              false,
            );
          }
        } catch (err) {
          console.error(`removalSync: mod log sweep failed (${type});`, err);
        }
      }
      return OK;
    },

    async sweepRemovedAppPosts(options) {
      const subreddit = options?.subredditName ?? context.subredditName;
      if (!subreddit) return OK;

      try {
        const appUser = await reddit.getAppUser();
        if (!appUser) return OK;

        const listing = reddit.getPostsByUser({
          username: appUser.username,
          sort: "new",
          limit: options?.limit ?? 1000,
          pageSize: 100,
        });
        for await (const post of listing) {
          if (post.subredditName !== subreddit) continue;
          // removedByCategory can be unset while removed is true, and spam
          // removals set spam separately; author-deleted posts fail all three,
          // which keeps repeated sweeps idempotent.
          const modRemoved =
            post.removedByCategory === "moderator" || post.isRemoved() || post.isSpam();
          if (!modRemoved) continue;

          const e: RemovalEvent = { kind: "post", targetId: post.id, source: "backfill" };
          if (options?.requireAppContent && !(await config.isAppContent(e))) continue;

          if (deleteContent) {
            try {
              await post.delete(); // author-delete — the app account authored it
            } catch (err) {
              console.error(`removalSync: content delete failed for ${post.id};`, err);
            }
          }
          try {
            await config.cleanup(e);
          } catch (err) {
            console.error(`removalSync: cleanup failed for ${post.id};`, err);
          }
        }
      } catch (err) {
        console.error("removalSync: app-posts sweep failed;", err);
      }
      return OK;
    },
  };
}
