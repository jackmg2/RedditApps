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

function kindOf(id: string): TrackedKind {
  return id.startsWith("t1_") ? "comment" : "post";
}

/** Registers a post this app created. Accepts a t3_ id. */
export async function trackPost(postId: string): Promise<void> {
  await redis.zAdd(KEYS.post, { member: postId, score: Date.now() });
}

/** Registers a comment this app created. Accepts a t1_ id. */
export async function trackComment(commentId: string): Promise<void> {
  await redis.zAdd(KEYS.comment, { member: commentId, score: Date.now() });
}

/** True if this app created the given post/comment (kind inferred from id). */
export async function isTracked(id: string): Promise<boolean> {
  const score = await redis.zScore(KEYS[kindOf(id)], id);
  return score !== undefined && score !== null;
}

/** Removes an id from the registry (after cleanup, or on author-delete). */
export async function untrack(id: string): Promise<void> {
  await redis.zRem(KEYS[kindOf(id)], [id]);
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
  return await redis.zRemRangeByScore(KEYS[kind], 0, cutoff);
}
