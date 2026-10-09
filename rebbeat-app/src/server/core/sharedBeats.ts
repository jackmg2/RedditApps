// Community beats (spec §4.10, collected from v1 so the v1.1 Browse panel
// needs no backfill). Devvit redis has no list commands, so the per-post
// "list" is a sorted set (member = commentId, score = timestamp) plus a hash
// holding each entry's JSON. The comments are the members' own (runAs:
// 'USER'), so entries are not removal-synced: the Browse panel must check
// that a comment is still visible before listing it.
import { redis } from '@devvit/web/server';

export const MAX_SHARED_BEATS_PER_POST = 100;

export type SharedBeatEntry = {
  commentId: string;
  code: string;
  username: string;
  ts: number;
};

const indexKey = (postId: string) => `beat:shared:${postId}`;
const dataKey = (postId: string) => `beat:shared:data:${postId}`;

const dropEntries = async (
  postId: string,
  commentIds: string[]
): Promise<void> => {
  if (commentIds.length === 0) return;
  await redis.zRem(indexKey(postId), commentIds);
  await redis.hDel(dataKey(postId), commentIds);
};

export const recordSharedBeat = async (
  postId: string,
  entry: SharedBeatEntry
): Promise<void> => {
  await redis.zAdd(indexKey(postId), {
    member: entry.commentId,
    score: entry.ts,
  });
  await redis.hSet(dataKey(postId), {
    [entry.commentId]: JSON.stringify(entry),
  });

  // Keep only the newest MAX_SHARED_BEATS_PER_POST entries.
  const total = await redis.zCard(indexKey(postId));
  if (total > MAX_SHARED_BEATS_PER_POST) {
    const oldest = await redis.zRange(
      indexKey(postId),
      0,
      total - MAX_SHARED_BEATS_PER_POST - 1,
      {
        by: 'rank',
      }
    );
    await dropEntries(
      postId,
      oldest.map((e) => e.member)
    );
  }
};

export const forgetSharedPost = async (postId: string): Promise<void> => {
  await redis.del(indexKey(postId), dataKey(postId));
};
