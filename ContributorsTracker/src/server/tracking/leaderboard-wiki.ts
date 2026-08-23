import { reddit, redis, scheduler } from "@devvit/web/server";
import {
  LEADERBOARD_WIKI_DEBOUNCE_TTL_MS,
  LEADERBOARD_WIKI_LIMIT,
  LEADERBOARD_WIKI_UPDATE_DELAY_MS,
} from "./config.ts";
import { renderLeaderboardWikiMarkdown } from "./leaderboard.ts";
import { getLeaderboardSize, getLeaderboardTop } from "./leaderboard-store.ts";
import { leaderboardWikiDebounceKey } from "./redis-keys.ts";
import {
  getMembersNoun,
  getWikiLeaderboardPageName,
  isWikiLeaderboardEnabled,
} from "./settings.ts";

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

export async function runLeaderboardWikiUpdate(
  data: LeaderboardWikiTaskData,
): Promise<void> {
  await redis.del(leaderboardWikiDebounceKey());
  if (!(await isWikiLeaderboardEnabled())) return;

  const page = await getWikiLeaderboardPageName();
  const [entries, totalMembers, membersNoun] = await Promise.all([
    getLeaderboardTop(LEADERBOARD_WIKI_LIMIT),
    getLeaderboardSize(),
    getMembersNoun(),
  ]);
  const options = {
    subredditName: data.subredditName,
    page,
    content: renderLeaderboardWikiMarkdown(
      entries,
      totalMembers,
      Date.now(),
      membersNoun,
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
