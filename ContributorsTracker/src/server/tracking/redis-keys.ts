import { REDIS_NAMESPACE } from "./config.ts";
import { bareThingId, normalizeUsername } from "./ids.ts";
import type { CompletedContribution } from "./types.ts";

export function CompletedContributionsKey(username: string): string {
  return `${REDIS_NAMESPACE}:completed:${normalizeUsername(username)}`;
}

export function postAuthorKey(postId: string): string {
  return `${REDIS_NAMESPACE}:post-author:${bareThingId(postId)}`;
}

export function userSyncMetaKey(username: string, subredditName?: string): string {
  return `${REDIS_NAMESPACE}:sync-meta:${normalizeUsername(username)}:${subredditName?.toLowerCase() ?? "all"}`;
}

export function userSyncLockKey(username: string, subredditName?: string): string {
  return `${REDIS_NAMESPACE}:sync-lock:${normalizeUsername(username)}:${subredditName?.toLowerCase() ?? "all"}`;
}

export function userBackfillStateKey(
  username: string,
  subredditName?: string,
): string {
  return `${REDIS_NAMESPACE}:backfill-state:${normalizeUsername(username)}:${subredditName?.toLowerCase() ?? "all"}`;
}

export function pendingHistoryPostsKey(
  username: string,
  subredditName?: string,
): string {
  return `${REDIS_NAMESPACE}:pending-history-posts:${normalizeUsername(username)}:${subredditName?.toLowerCase() ?? "all"}`;
}

export function historyCommentKey(postId: string): string {
  return `${REDIS_NAMESPACE}:history-comment:${bareThingId(postId)}`;
}

export function historyCommentPostKey(commentId: string): string {
  return `${REDIS_NAMESPACE}:history-comment-post:${bareThingId(commentId)}`;
}

export function trackedFlairRulesOverridesKey(subredditName?: string): string {
  return `${REDIS_NAMESPACE}:tracked-flair-overrides:${subredditName?.toLowerCase() ?? "all"}`;
}

export function completionRecordKey(completed: CompletedContribution): string {
  return bareThingId(completed.postId);
}
