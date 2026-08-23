import { redis } from "@devvit/web/server";
import { normalizeUsername } from "./ids.ts";
import type { LeaderboardEntry, LeaderboardStanding } from "./leaderboard.ts";
import { CompletedContributionsKey, leaderboardKey } from "./redis-keys.ts";

/**
 * Recomputes the user's leaderboard score from their completed hash. Idempotent
 * so repeated saves of the same post (edits, re-scans) never inflate the score.
 */
export async function syncLeaderboardScore(username: string): Promise<number> {
  const member = normalizeUsername(username);
  const count = await redis.hLen(CompletedContributionsKey(member));

  if (count > 0) {
    await redis.zAdd(leaderboardKey(), { member, score: count });
  } else {
    await redis.zRem(leaderboardKey(), [member]);
  }

  return count;
}

/**
 * The user's standing for the history comment. Heals a stale or missing
 * leaderboard entry from `expectedCount`, so installs that predate the
 * leaderboard index their members as comments refresh.
 */
export async function getLeaderboardStanding(
  username: string,
  expectedCount: number,
): Promise<LeaderboardStanding | undefined> {
  if (expectedCount <= 0) return undefined;

  const member = normalizeUsername(username);
  const score = await redis.zScore(leaderboardKey(), member);
  if (score !== expectedCount) {
    await redis.zAdd(leaderboardKey(), { member, score: expectedCount });
  }

  // Counts are integers, so `count + 1 .. +inf` is exactly "strictly greater".
  const [totalMembers, higher] = await Promise.all([
    redis.zCard(leaderboardKey()),
    redis.zRange(leaderboardKey(), expectedCount + 1, "+inf", { by: "score" }),
  ]);

  return {
    count: expectedCount,
    totalMembers,
    strictlyHigherCount: higher.length,
  };
}

export async function getLeaderboardTop(
  limit: number,
): Promise<LeaderboardEntry[]> {
  return redis.zRange(leaderboardKey(), 0, limit - 1, {
    by: "rank",
    reverse: true,
  });
}

export async function getLeaderboardSize(): Promise<number> {
  return redis.zCard(leaderboardKey());
}
