import { context, reddit, redis, scheduler } from "@devvit/web/server";
import {
  LEADERBOARD_WIKI_DEBOUNCE_TTL_MS,
  LEADERBOARD_WIKI_LIMIT,
  LEADERBOARD_WIKI_UPDATE_DELAY_MS,
  STREAK_WIKI_LIMIT,
} from "./config.ts";
import { renderLeaderboardWikiMarkdown } from "./leaderboard.ts";
import { getLeaderboardSize, getLeaderboardTop } from "./leaderboard-store.ts";
import { leaderboardWikiDebounceKey } from "./redis-keys.ts";
import {
  getMembersNoun,
  getWikiLeaderboardPageName,
  isStreakEnabled,
  isWikiLeaderboardEnabled,
} from "./settings.ts";
import type { StreakEntry } from "./streak.ts";
import { getActiveStreakers } from "./streak-store.ts";

export type LeaderboardWikiTaskData = {
  subredditName: string;
};

/**
 * Schedules a leaderboard wiki refresh, coalescing bursts of score changes:
 * the NX debounce key lets only the first caller in the window schedule the
 * job, and the job clears the key when it runs.
 */
export async function scheduleLeaderboardWikiUpdate(
  subredditName: string,
): Promise<void> {
  if (!(await isWikiLeaderboardEnabled())) return;

  const acquired = await redis.set(leaderboardWikiDebounceKey(), "1", {
    nx: true,
    expiration: new Date(Date.now() + LEADERBOARD_WIKI_DEBOUNCE_TTL_MS),
  });
  if (acquired !== "OK") return;

  await scheduler.runJob({
    name: "leaderboardWikiUpdate",
    data: { subredditName },
    runAt: new Date(Date.now() + LEADERBOARD_WIKI_UPDATE_DELAY_MS),
  });
}

async function getWikiStreakEntries(): Promise<StreakEntry[] | undefined> {
  if (!(await isStreakEnabled())) return undefined;
  return (await getActiveStreakers()).slice(0, STREAK_WIKI_LIMIT);
}

/**
 * Daily cron: streaks break with time alone, so refresh the wiki once a day to
 * drop them. Never creates the page before the first tracked contribution.
 */
export async function runStreakDailyRefresh(): Promise<void> {
  const subredditName = context.subredditName;
  if (!subredditName) return;
  if (!(await isStreakEnabled()) || !(await isWikiLeaderboardEnabled())) return;
  if ((await getLeaderboardSize()) === 0) return;

  await runLeaderboardWikiUpdate({ subredditName });
}

export async function runLeaderboardWikiUpdate(
  data: LeaderboardWikiTaskData,
): Promise<void> {
  await redis.del(leaderboardWikiDebounceKey());
  if (!(await isWikiLeaderboardEnabled())) return;

  const page = await getWikiLeaderboardPageName();
  const [entries, totalMembers, membersNoun, streakEntries] = await Promise.all([
    getLeaderboardTop(LEADERBOARD_WIKI_LIMIT),
    getLeaderboardSize(),
    getMembersNoun(),
    getWikiStreakEntries(),
  ]);
  const options = {
    subredditName: data.subredditName,
    page,
    content: renderLeaderboardWikiMarkdown(
      entries,
      totalMembers,
      Date.now(),
      membersNoun,
      streakEntries,
    ),
    reason: "contributorstracker leaderboard update",
  };

  // The page is created lazily on the first tracked contribution, never at
  // install time. If creation fails too (e.g. the wiki is disabled), the
  // error propagates to the scheduler endpoint's error handler.
  let exists = true;
  try {
    await reddit.getWikiPage(data.subredditName, page);
  } catch {
    exists = false;
  }

  if (exists) {
    await reddit.updateWikiPage(options);
  } else {
    await reddit.createWikiPage(options);
  }
}
