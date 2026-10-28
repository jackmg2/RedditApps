import { redis } from "@devvit/web/server";
import { MIN_STREAKER_DAYS } from "./config.ts";
import { normalizeUsername } from "./ids.ts";
import { streakLastDayKey, streaksKey } from "./redis-keys.ts";
import { getStreakGraceDays } from "./settings.ts";
import {
  computeStreak,
  isStreakAlive,
  streakRank,
  utcDay,
  type StreakEntry,
  type StreakView,
} from "./streak.ts";
import type { CompletedContribution } from "./types.ts";

function todayUtcDay(): number {
  return utcDay(Date.now() / 1000);
}

/**
 * Recomputes the user's streak from their completed contributions and stores it
 * in the streak index. Idempotent, so every history-comment render heals a
 * stale or missing entry (installs that predate streaks fill in gradually).
 */
export async function syncStreak(
  username: string,
  completed: CompletedContribution[],
  todayDay: number = todayUtcDay(),
  graceDays?: number,
): Promise<number> {
  const member = normalizeUsername(username);
  const grace = graceDays ?? (await getStreakGraceDays());
  const streak = computeStreak(
    completed.map((contribution) => contribution.createdUtc),
    todayDay,
    grace,
  );

  if (streak.length > 0 && streak.lastDay !== undefined) {
    await Promise.all([
      redis.zAdd(streaksKey(), { member, score: streak.length }),
      redis.hSet(streakLastDayKey(), { [member]: String(streak.lastDay) }),
    ]);
  } else {
    await Promise.all([
      redis.zRem(streaksKey(), [member]),
      redis.hDel(streakLastDayKey(), [member]),
    ]);
  }

  return streak.length;
}

/**
 * Streakers ({@link MIN_STREAKER_DAYS}+ days) whose streak is still alive,
 * longest first. Entries whose streak broke since they were stored are pruned.
 */
export async function getActiveStreakers(
  todayDay: number = todayUtcDay(),
  graceDays?: number,
): Promise<StreakEntry[]> {
  const grace = graceDays ?? (await getStreakGraceDays());
  const candidates = await redis.zRange(streaksKey(), MIN_STREAKER_DAYS, "+inf", {
    by: "score",
  });
  if (candidates.length === 0) return [];

  const lastDays = await redis.hMGet(
    streakLastDayKey(),
    candidates.map(({ member }) => member),
  );

  const active: StreakEntry[] = [];
  const dead: string[] = [];
  for (const [index, { member, score }] of candidates.entries()) {
    const lastDay = Number(lastDays[index]);
    if (lastDays[index] != null && isStreakAlive(lastDay, todayDay, grace)) {
      active.push({ member, days: score });
    } else {
      dead.push(member);
    }
  }

  if (dead.length > 0) {
    await Promise.all([
      redis.zRem(streaksKey(), dead),
      redis.hDel(streakLastDayKey(), dead),
    ]);
  }

  return active.sort((a, b) => b.days - a.days || a.member.localeCompare(b.member));
}

/** The user's streak for the history comment, ranked among active streakers. */
export async function getStreakView(
  username: string,
  completed: CompletedContribution[],
): Promise<StreakView> {
  const asOfDay = todayUtcDay();
  const grace = await getStreakGraceDays();
  const length = await syncStreak(username, completed, asOfDay, grace);
  if (length < MIN_STREAKER_DAYS) return { length, asOfDay };

  const streakers = await getActiveStreakers(asOfDay, grace);
  return {
    length,
    asOfDay,
    rank: streakRank(length, streakers.map(({ days }) => days)),
  };
}
