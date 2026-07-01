import { reddit, scheduler } from "@devvit/web/server";
import {
  BACKFILL_CHUNK_SIZE,
  HISTORY_COMMENT_UPDATE_CONCURRENCY,
  MAX_HISTORY_COMMENT_UPDATES_PER_RUN,
} from "./config.ts";
import { trackedFlairRuleForText } from "./flair.ts";
import { bareThingId, normalizeUsername } from "./ids.ts";
import { resolveTrackedItemFromTitle } from "./contribution-matching.ts";
import { completionFromPost } from "./completion-factory.ts";
import { getCompletedItems, saveCompletion } from "./completion-store.ts";
import {
  acquireUserBackfillLock,
  clearBackfillState,
  clearPendingHistoryPosts,
  createBackfillState,
  getBackfillState,
  getPendingHistoryPostIds,
  releaseUserBackfillLock,
  setBackfillState,
  setUserSyncMeta,
  shouldBackfillUser,
} from "./sync-store.ts";
import { buildHistoryComment } from "./history-renderer.ts";
import { getHistoryLabels } from "./settings.ts";
import {
  updateExistingHistoryComment,
  upsertHistoryComment,
} from "./history-comments.ts";
import type { BackfillTaskData } from "./types.ts";
import type { Post } from "@devvit/reddit";

export async function scheduleBackfillJob(
  data: BackfillTaskData,
  delayMs = 1000,
): Promise<void> {
  await scheduler.runJob({
    name: "trackingBackfill",
    data,
    runAt: new Date(Date.now() + delayMs),
  });
}

export async function startBackfillUser(
  username: string,
  subredditName?: string,
): Promise<boolean> {
  if (!(await shouldBackfillUser(username, subredditName))) return false;
  if (!(await acquireUserBackfillLock(username, subredditName))) return true;

  const data: BackfillTaskData = {
    username: normalizeUsername(username),
    ...(subredditName ? { subredditName } : {}),
  };

  await createBackfillState(username, subredditName);
  await scheduleBackfillJob(data);
  return true;
}

async function saveCompletionFromHistoricalPost(
  post: Post,
  subredditName: string,
): Promise<void> {
  const trackingRule = await trackedFlairRuleForText(post.flair?.text, subredditName);
  if (!trackingRule) return;

  const trackedItem = resolveTrackedItemFromTitle(post.title, trackingRule);

  await saveCompletion(completionFromPost(post, trackedItem, trackingRule.trackContributors));
}

async function updateHistoryTablesAfterBackfill(
  username: string,
  subredditName?: string,
): Promise<void> {
  const completed = await getCompletedItems(username);
  const labels = await getHistoryLabels();
  const body = buildHistoryComment(username, completed, labels);
  const pendingPostIds = await getPendingHistoryPostIds(username, subredditName);
  const recentPostIds = completed
    .sort((a, b) => b.createdUtc - a.createdUtc || a.postId.localeCompare(b.postId))
    .slice(0, MAX_HISTORY_COMMENT_UPDATES_PER_RUN)
    .map((contribution) => bareThingId(contribution.postId));
  const postIds = new Set<string>([
    ...recentPostIds,
    ...pendingPostIds.map(bareThingId),
  ]);

  const boundedPostIds = [...postIds].slice(0, MAX_HISTORY_COMMENT_UPDATES_PER_RUN);
  for (let i = 0; i < boundedPostIds.length; i += HISTORY_COMMENT_UPDATE_CONCURRENCY) {
    const batch = boundedPostIds.slice(i, i + HISTORY_COMMENT_UPDATE_CONCURRENCY);
    await Promise.allSettled(
      batch.map((postId) => updateExistingHistoryComment(postId, body)),
    );
  }

  for (let i = 0; i < pendingPostIds.length; i += HISTORY_COMMENT_UPDATE_CONCURRENCY) {
    const batch = pendingPostIds.slice(i, i + HISTORY_COMMENT_UPDATE_CONCURRENCY);
    await Promise.allSettled(batch.map((postId) => upsertHistoryComment(postId, body)));
  }
  await clearPendingHistoryPosts(username, subredditName);
}

async function finishBackfill(
  username: string,
  subredditName: string | undefined,
  limit: number,
): Promise<void> {
  const completed = await getCompletedItems(username);
  await setUserSyncMeta(username, subredditName, limit, completed.length);
  await updateHistoryTablesAfterBackfill(username, subredditName);
  await clearBackfillState(username, subredditName);
  await releaseUserBackfillLock(username, subredditName);
}

export async function runBackfillChunk(data: BackfillTaskData): Promise<void> {
  if (!data.subredditName) return;

  const username = normalizeUsername(data.username);
  const subredditName = data.subredditName;
  const state = await getBackfillState(username, subredditName);
  if (!state) return;

  const cleanSubredditName = subredditName.toLowerCase();
  const remaining = Math.max(state.limit - state.processed, 0);
  if (remaining === 0) {
    await finishBackfill(username, subredditName, state.limit);
    return;
  }

  const pageSize = Math.min(BACKFILL_CHUNK_SIZE, remaining);
  const posts = await reddit
    .getPostsByUser({
      username,
      sort: "new",
      timeframe: "all",
      limit: pageSize,
      pageSize,
      ...(state.after ? { after: state.after } : {}),
    })
    .all();

  for (const post of posts) {
    if (post.subredditName.toLowerCase() !== cleanSubredditName) {
      continue;
    }

    await saveCompletionFromHistoricalPost(post, subredditName);
  }

  const processed = state.processed + posts.length;
  const lastPost = posts.at(-1);
  if (posts.length < pageSize || !lastPost) {
    await finishBackfill(username, subredditName, state.limit);
    return;
  }

  await setBackfillState(username, subredditName, {
    ...state,
    after: lastPost.id,
    processed,
  });
  await scheduleBackfillJob({ username, ...(subredditName ? { subredditName } : {}) });
}
