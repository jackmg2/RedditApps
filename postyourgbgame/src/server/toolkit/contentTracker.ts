// Copied from _shared/toolkit — do not edit in the app.
// Edit c:\Dev\02_RedditApps\_shared\toolkit and run: node ../_shared/sync-toolkit.mjs sync --all
//
// Rule 1 support: redis registry of the posts/comments this app created, so
// removal-sync triggers can tell app content apart from everything else.
// Devvit redis is namespaced per installation; keys only need to avoid
// colliding with the app's own keys.

import { redis } from "@devvit/web/server";

export type TrackedKind = "post" | "comment";

const KEYS: Record<TrackedKind, string> = {
  post: "app:content:posts",
  comment: "app:content:comments",
};

// Post→comment association, so removal-sync can find the app's comments
// under a third-party post the author deleted. Forward: hash field t3_ id →
// comma-joined t1_ ids. Reverse: hash field t1_ id → t3_ id, so untrack of
// a single comment can clean its forward entry without scanning.
const COMMENTS_BY_POST = "app:content:commentsByPost";
const COMMENT_PARENT = "app:content:commentParent";

function kindOf(id: string): TrackedKind {
  return id.startsWith("t1_") ? "comment" : "post";
}

/** Registers a post this app created. Accepts a t3_ id. */
export async function trackPost(postId: string): Promise<void> {
  await redis.zAdd(KEYS.post, { member: postId, score: Date.now() });
}

/**
 * Registers a comment this app created. Accepts a t1_ id. Pass the parent
 * post's t3_ id to also record the post→comment association, which lets
 * removalSync's `commentsUnderPost` flow self-delete the comment when the
 * post's author deletes the post.
 */
export async function trackComment(commentId: string, parentPostId?: string): Promise<void> {
  await redis.zAdd(KEYS.comment, { member: commentId, score: Date.now() });
  if (!parentPostId) return;
  // Read-modify-write append: concurrent trackComment calls for the same
  // post could drop an id, but no app comments twice on one post at once.
  const existing = await redis.hGet(COMMENTS_BY_POST, parentPostId);
  const ids = existing ? existing.split(",") : [];
  if (!ids.includes(commentId)) ids.push(commentId);
  await redis.hSet(COMMENTS_BY_POST, { [parentPostId]: ids.join(",") });
  await redis.hSet(COMMENT_PARENT, { [commentId]: parentPostId });
}

/** App-created comment ids recorded under the given t3_ post id. */
export async function commentsUnderPost(postId: string): Promise<string[]> {
  const value = await redis.hGet(COMMENTS_BY_POST, postId);
  return value ? value.split(",") : [];
}

async function untrackCommentMapping(commentId: string): Promise<void> {
  const postId = await redis.hGet(COMMENT_PARENT, commentId);
  if (postId === undefined || postId === null) return;
  const siblings = ((await redis.hGet(COMMENTS_BY_POST, postId)) ?? "")
    .split(",")
    .filter((id) => id && id !== commentId);
  if (siblings.length > 0) {
    await redis.hSet(COMMENTS_BY_POST, { [postId]: siblings.join(",") });
  } else {
    await redis.hDel(COMMENTS_BY_POST, [postId]);
  }
  await redis.hDel(COMMENT_PARENT, [commentId]);
}

/** True if this app created the given post/comment (kind inferred from id). */
export async function isTracked(id: string): Promise<boolean> {
  const score = await redis.zScore(KEYS[kindOf(id)], id);
  return score !== undefined && score !== null;
}

/** Removes an id from the registry (after cleanup, or on author-delete). */
export async function untrack(id: string): Promise<void> {
  await redis.zRem(KEYS[kindOf(id)], [id]);
  if (kindOf(id) === "comment") {
    await untrackCommentMapping(id);
  }
}

/** All tracked ids of one kind, oldest first — for backfill sweeps. */
export async function listTracked(kind: TrackedKind): Promise<string[]> {
  const entries = await redis.zRange(KEYS[kind], 0, -1, { by: "rank" });
  return entries.map((e) => e.member);
}

/**
 * Drops registry entries older than maxAgeDays. Optional hygiene for
 * high-volume apps (e.g. one auto-comment per post); call fire-and-forget
 * from an existing trigger. Returns the number of entries removed.
 */
export async function pruneOlderThan(
  kind: TrackedKind,
  maxAgeDays: number,
): Promise<number> {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  if (kind === "comment") {
    // The post→comment hashes must not outlive the registry entries.
    const expiring = await redis.zRange(KEYS.comment, 0, cutoff, { by: "score" });
    for (const entry of expiring) {
      await untrackCommentMapping(entry.member);
    }
  }
  return await redis.zRemRangeByScore(KEYS[kind], 0, cutoff);
}
