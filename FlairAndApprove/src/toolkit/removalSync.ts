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

type PostDeletePayload = { postId?: string };
type CommentDeletePayload = { commentId?: string };

type TriggerResult = { status: "success" };

const OK: TriggerResult = { status: "success" };

export type RemovalSync = {
  handleModAction(payload: ModActionPayload): Promise<TriggerResult>;
  handlePostDelete(payload: PostDeletePayload): Promise<TriggerResult>;
  handleCommentDelete(payload: CommentDeletePayload): Promise<TriggerResult>;
  /** onAppUpgrade backfill: the live trigger only catches removals going
   *  forward; this sweeps the subreddit mod log for earlier ones. */
  handleAppUpgradeBackfill(subredditName?: string): Promise<TriggerResult>;
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
  };
}
