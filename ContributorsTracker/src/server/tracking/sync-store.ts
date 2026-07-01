import { redis } from "@devvit/web/server";
import {
  DEFAULT_SCAN_LIMIT,
  USER_BACKFILL_LOCK_MS,
  USER_BACKFILL_REFRESH_MS,
} from "./config.ts";
import { bareThingId, normalizeUsername } from "./ids.ts";
import {
  pendingHistoryPostsKey,
  userBackfillStateKey,
  userSyncLockKey,
  userSyncMetaKey,
} from "./redis-keys.ts";
import type { BackfillState, UserSyncMeta } from "./types.ts";
import { CompletedContributionsKey } from "./redis-keys.ts";

export async function getUserSyncMeta(
  username: string,
  subredditName?: string,
): Promise<UserSyncMeta | undefined> {
  const value = await redis.get(userSyncMetaKey(username, subredditName));
  return value ? (JSON.parse(value) as UserSyncMeta) : undefined;
}

export async function setUserSyncMeta(
  username: string,
  subredditName: string | undefined,
  limit: number,
  completionCount: number,
): Promise<void> {
  const meta: UserSyncMeta = {
    username: normalizeUsername(username),
    subredditName,
    lastFullSyncAtUtc: Math.floor(Date.now() / 1000),
    lastFullSyncLimit: limit,
    completionCount,
  };

  await redis.set(userSyncMetaKey(username, subredditName), JSON.stringify(meta));
}

export async function acquireUserBackfillLock(
  username: string,
  subredditName?: string,
): Promise<boolean> {
  const result = await redis.set(userSyncLockKey(username, subredditName), "1", {
    nx: true,
    expiration: new Date(Date.now() + USER_BACKFILL_LOCK_MS),
  });

  return result === "OK";
}

export async function releaseUserBackfillLock(
  username: string,
  subredditName?: string,
): Promise<void> {
  await redis.del(userSyncLockKey(username, subredditName));
}

export async function shouldBackfillUser(
  username: string,
  subredditName?: string,
): Promise<boolean> {
  const meta = await getUserSyncMeta(username, subredditName);
  if (!meta) return true;

  const completionCount = await redis.hLen(CompletedContributionsKey(username));
  if (completionCount < meta.completionCount) return true;

  const lastSyncMs = meta.lastFullSyncAtUtc * 1000;
  return Date.now() - lastSyncMs > USER_BACKFILL_REFRESH_MS;
}

export async function addPendingHistoryPost(
  username: string,
  postId: string,
  subredditName?: string,
): Promise<void> {
  await redis.hSet(pendingHistoryPostsKey(username, subredditName), {
    [bareThingId(postId)]: "1",
  });
}

export async function getPendingHistoryPostIds(
  username: string,
  subredditName?: string,
): Promise<string[]> {
  return redis.hKeys(pendingHistoryPostsKey(username, subredditName));
}

export async function clearPendingHistoryPosts(
  username: string,
  subredditName?: string,
): Promise<void> {
  await redis.del(pendingHistoryPostsKey(username, subredditName));
}

export async function createBackfillState(
  username: string,
  subredditName?: string,
): Promise<BackfillState> {
  const state: BackfillState = {
    username: normalizeUsername(username),
    ...(subredditName ? { subredditName } : {}),
    limit: DEFAULT_SCAN_LIMIT,
    processed: 0,
  };

  await setBackfillState(username, subredditName, state);
  return state;
}

export async function getBackfillState(
  username: string,
  subredditName?: string,
): Promise<BackfillState | undefined> {
  const value = await redis.get(userBackfillStateKey(username, subredditName));
  return value ? (JSON.parse(value) as BackfillState) : undefined;
}

export async function setBackfillState(
  username: string,
  subredditName: string | undefined,
  state: BackfillState,
): Promise<void> {
  await redis.set(userBackfillStateKey(username, subredditName), JSON.stringify(state));
}

export async function clearBackfillState(
  username: string,
  subredditName?: string,
): Promise<void> {
  await redis.del(userBackfillStateKey(username, subredditName));
}
