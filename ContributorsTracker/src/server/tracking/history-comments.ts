import { reddit, redis } from "@devvit/web/server";
import type { Comment, Post } from "@devvit/reddit";
import type { T3 } from "@devvit/web/shared";
import {
  historyCommentKey,
  historyCommentPostKey,
} from "./redis-keys.ts";
import { bareThingId, thingId } from "./ids.ts";
import type { CompletedContribution } from "./types.ts";
import {
  HISTORY_COMMENT_UPDATE_CONCURRENCY,
  MAX_HISTORY_COMMENT_UPDATES_PER_RUN,
} from "./config.ts";

export async function findHistoryCommentOnPost(
  post: Post,
  body: string,
): Promise<Comment | undefined> {
  const historyHeader = body.split("\n", 1)[0] ?? "";
  const comments = await post.comments.get(100);

  return comments.find((comment) => comment.body.startsWith(historyHeader));
}

export async function upsertHistoryComment(
  postId: string,
  body: string,
): Promise<Comment> {
  const key = historyCommentKey(postId);
  const existingCommentId = await redis.get(key);

  if (existingCommentId) {
    try {
      const comment = await reddit.getCommentById(thingId(existingCommentId, "t1"));
      return comment.edit({ text: body, runAs: "APP" });
    } catch (err) {
      console.warn(`Could not edit history comment ${existingCommentId}: ${err}`);
    }
  }

  const post = await reddit.getPostById(thingId(postId, "t3") as T3);
  const recoveredComment = await findHistoryCommentOnPost(post, body);
  if (recoveredComment) {
    await redis.set(key, recoveredComment.id);
    await redis.set(historyCommentPostKey(recoveredComment.id), post.id);
    return recoveredComment.edit({ text: body, runAs: "APP" });
  }

  const comment = await post.addComment({ text: body, runAs: "APP" });
  await redis.set(key, comment.id);
  await redis.set(historyCommentPostKey(comment.id), postId);
  return comment;
}

export async function updateExistingHistoryComment(
  postId: string,
  body: string,
): Promise<void> {
  const existingCommentId = await redis.get(historyCommentKey(postId));

  if (existingCommentId) {
    try {
      const comment = await reddit.getCommentById(thingId(existingCommentId, "t1"));
      await comment.edit({ text: body, runAs: "APP" });
      return;
    } catch (err) {
      console.warn(`Could not update history comment ${existingCommentId}: ${err}`);
    }
  }

  try {
    const post = await reddit.getPostById(thingId(postId, "t3") as T3);
    const recoveredComment = await findHistoryCommentOnPost(post, body);
    if (recoveredComment) {
      await redis.set(historyCommentKey(postId), recoveredComment.id);
      await redis.set(historyCommentPostKey(recoveredComment.id), post.id);
      await recoveredComment.edit({ text: body, runAs: "APP" });
    }
  } catch (err) {
    console.warn(`Could not recover history comment on post ${postId}: ${err}`);
  }
}

/**
 * Permanently deletes the bot's history comment when a moderator removes it, and
 * clears its Redis keys so it is never re-edited or recreated. Returns false (and
 * does nothing) for any comment the app did not author — the reverse-lookup key is
 * what distinguishes our history comments from every other comment in the subreddit.
 */
export async function deleteBotHistoryComment(commentId: string): Promise<boolean> {
  const bareId = bareThingId(commentId);
  const postId = await redis.get(historyCommentPostKey(bareId));
  if (!postId) return false;

  try {
    const comment = await reddit.getCommentById(thingId(commentId, "t1"));
    await comment.delete();
  } catch (err) {
    console.warn(`Could not delete bot history comment ${commentId}: ${err}`);
  }

  await redis.del(historyCommentKey(postId));
  await redis.del(historyCommentPostKey(bareId));
  return true;
}

export async function updateExistingHistoryCommentsForUser(
  completed: CompletedContribution[],
  body: string,
): Promise<void> {
  const recent = [...completed]
    .sort((a, b) => b.createdUtc - a.createdUtc || a.postId.localeCompare(b.postId))
    .slice(0, MAX_HISTORY_COMMENT_UPDATES_PER_RUN);

  for (let i = 0; i < recent.length; i += HISTORY_COMMENT_UPDATE_CONCURRENCY) {
    const batch = recent.slice(i, i + HISTORY_COMMENT_UPDATE_CONCURRENCY);
    await Promise.allSettled(
      batch.map((contribution) => updateExistingHistoryComment(contribution.postId, body)),
    );
  }
}
