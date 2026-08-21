import { redis } from '@devvit/web/server';

export type BanRecord = {
  removedPostIds: string[];
  removedCommentIds: string[];
  lockedPostIds: string[];
  bannedAt: number;
  markAsSpam: boolean;
};

// Records expire so redis doesn't grow unboundedly; older bans degrade to unban-only.
const RECORD_TTL_SECONDS = 90 * 24 * 60 * 60;

function recordKey(subredditName: string, username: string): string {
  return `banrecord:${subredditName}:${username.toLowerCase()}`;
}

/**
 * Persist what the app removed/locked at ban time. Merges with any existing
 * record (union of ids, earliest bannedAt) so a re-ban doesn't lose earlier data.
 */
export async function mergeBanRecord(
  subredditName: string,
  username: string,
  record: BanRecord
): Promise<void> {
  const existing = await getBanRecord(subredditName, username);
  const merged: BanRecord = existing
    ? {
        removedPostIds: union(existing.removedPostIds, record.removedPostIds),
        removedCommentIds: union(existing.removedCommentIds, record.removedCommentIds),
        lockedPostIds: union(existing.lockedPostIds, record.lockedPostIds),
        bannedAt: Math.min(existing.bannedAt, record.bannedAt),
        markAsSpam: record.markAsSpam,
      }
    : record;
  await writeBanRecord(subredditName, username, merged);
}

/** Overwrite the stored record (used after a partial undo to keep only the remainder). */
export async function writeBanRecord(
  subredditName: string,
  username: string,
  record: BanRecord
): Promise<void> {
  const key = recordKey(subredditName, username);
  await redis.set(key, JSON.stringify(record));
  await redis.expire(key, RECORD_TTL_SECONDS);
}

export async function getBanRecord(
  subredditName: string,
  username: string
): Promise<BanRecord | undefined> {
  try {
    const raw = await redis.get(recordKey(subredditName, username));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as BanRecord;
    return {
      removedPostIds: parsed.removedPostIds ?? [],
      removedCommentIds: parsed.removedCommentIds ?? [],
      lockedPostIds: parsed.lockedPostIds ?? [],
      bannedAt: parsed.bannedAt ?? 0,
      markAsSpam: Boolean(parsed.markAsSpam),
    };
  } catch (error) {
    console.error(`Failed to read ban record for ${username}: ${error}`);
    return undefined;
  }
}

export async function deleteBanRecord(subredditName: string, username: string): Promise<void> {
  await redis.del(recordKey(subredditName, username));
}

function union(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])];
}
