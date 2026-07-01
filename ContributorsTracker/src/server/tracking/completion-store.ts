import { redis } from "@devvit/web/server";
import {
  CompletedContributionsKey,
  completionRecordKey,
  postAuthorKey,
} from "./redis-keys.ts";
import { normalizeUsername } from "./ids.ts";
import type { TrackedItemRecord, CompletionEntry } from "./types.ts";
import { mergeCompletion } from "./completion-domain.ts";

export async function saveCompletion(completed: TrackedItemRecord): Promise<void> {
  const recordKey = completionRecordKey(completed);
  const existingValue = await redis.hGet(CompletedContributionsKey(completed.author), recordKey);
  const existing = existingValue
    ? (JSON.parse(existingValue) as TrackedItemRecord)
    : undefined;
  const merged = mergeCompletion(existing, completed);

  await redis.hSet(CompletedContributionsKey(completed.author), {
    [recordKey]: JSON.stringify(merged),
  });
  await redis.set(postAuthorKey(completed.postId), normalizeUsername(completed.author));
}

export async function getCompletedItems(
  username: string,
): Promise<TrackedItemRecord[]> {
  const records = await redis.hGetAll(CompletedContributionsKey(username));

  return Object.values(records)
    .map((value) => JSON.parse(value) as TrackedItemRecord)
    .sort((a, b) => a.createdUtc - b.createdUtc || a.name.localeCompare(b.name));
}

export async function getCompletionEntries(
  username: string,
): Promise<CompletionEntry[]> {
  const records = await redis.hGetAll(CompletedContributionsKey(username));

  return Object.entries(records).map(([key, value]) => ({
    key,
    item: JSON.parse(value) as TrackedItemRecord,
  }));
}

export async function deleteCompletionEntries(
  username: string,
  keys: string[],
): Promise<void> {
  if (keys.length === 0) return;
  await redis.hDel(CompletedContributionsKey(username), keys);
}

export async function getStoredPostAuthor(
  postId: string,
): Promise<string | undefined> {
  return (await redis.get(postAuthorKey(postId))) ?? undefined;
}

export async function clearPostAuthor(postId: string): Promise<void> {
  await redis.del(postAuthorKey(postId));
}
