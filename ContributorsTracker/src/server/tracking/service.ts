import { reddit } from "@devvit/web/server";
import type { PostV2 } from "@devvit/shared";
import type { T3 } from "@devvit/web/shared";
import { DEFAULT_SCAN_LIMIT } from "./config.ts";
import {
  getInstalledSubredditName,
  isInstalledSubreddit,
} from "./subreddit.ts";
import { runBackfillChunk } from "./backfill.ts";
import { completionFromPost } from "./completion-factory.ts";
import {
  clearPostAuthor,
  deleteCompletionEntries,
  getCompletedItems,
  getCompletionEntries,
  getStoredPostAuthor,
  saveCompletion,
} from "./completion-store.ts";
import { resolveTrackedItemFromTitle } from "./contribution-matching.ts";
import {
  trackedFlairRuleForText,
} from "./flair.ts";
import {
  deleteBotHistoryComment,
  updateExistingHistoryComment,
  updateExistingHistoryCommentsForUser,
  upsertHistoryComment,
} from "./history-comments.ts";
import { buildHistoryComment } from "./history-renderer.ts";
import { bareThingId, normalizeUsername, thingId } from "./ids.ts";
import { addPendingHistoryPost, setUserSyncMeta } from "./sync-store.ts";
import { getHistoryLabels, isAutoCommentEnabled } from "./settings.ts";
import {
  fetchTrackedFlairRules,
  listManualTrackedFlairRules,
  makeManualTrackedFlairRule,
  removeManualTrackedFlairRule,
  upsertManualTrackedFlairRule,
} from "./flair-rule-store.ts";
import type {
  BackfillTaskData,
  CompletedContribution,
  UserItemsResult,
  TrackPostResult,
  UntrackPostResult,
} from "./types.ts";
import { startBackfillUser } from "./backfill.ts";

/**
 * Builds a history comment using the subreddit's configured wording. Wraps the
 * pure {@link buildHistoryComment} so callers don't each have to fetch labels.
 */
async function buildUserHistoryComment(
  username: string,
  completed: CompletedContribution[],
): Promise<string> {
  const labels = await getHistoryLabels();
  return buildHistoryComment(username, completed, labels);
}

async function refreshKnownHistoryComments(
  username: string,
): Promise<string> {
  const allCompleted = await getCompletedItems(username);
  const body = await buildUserHistoryComment(username, allCompleted);
  await updateExistingHistoryCommentsForUser(allCompleted, body);
  return body;
}

async function isModerator(username: string | undefined): Promise<boolean> {
  if (!username) return false;

  const moderators = await reddit
    .getModerators({
      subredditName: getInstalledSubredditName(),
      username: normalizeUsername(username),
      limit: 1,
      pageSize: 1,
    })
    .all();

  return moderators.some(
    (moderator) =>
      moderator.username?.toLowerCase() === normalizeUsername(username),
  );
}

async function removeCompletionForPost(postId: string): Promise<UntrackPostResult> {
  const barePostId = bareThingId(postId);
  const post = await reddit.getPostById(thingId(barePostId, "t3") as T3);
  const entries = await getCompletionEntries(post.authorName);
  const removed = entries.filter(
    ({ item }) => bareThingId(item.postId) === barePostId,
  );
  const affectedPostIds = new Set<string>([
    barePostId,
    ...entries.map(({ item }) => bareThingId(item.postId)),
  ]);

  if (removed.length === 0) {
    const completed = await getCompletedItems(post.authorName);
    const body = await buildUserHistoryComment(post.authorName, completed);
    await updateExistingHistoryComment(barePostId, body);
    return { untracked: false, reason: "post was not tracked as an item" };
  }

  await deleteCompletionEntries(post.authorName, removed.map(({ key }) => key));
  await clearPostAuthor(barePostId);

  const completed = await getCompletedItems(post.authorName);
  const body = await buildUserHistoryComment(post.authorName, completed);
  await Promise.all(
    [...affectedPostIds].map((affectedPostId) =>
      updateExistingHistoryComment(affectedPostId, body),
    ),
  );

  return { untracked: true };
}

export async function removeCompletionForDeletedPost(
  postId: string,
  authorName?: string,
  subredditName?: string,
): Promise<UntrackPostResult> {
  if (!isInstalledSubreddit(subredditName)) {
    return { untracked: false, reason: "ignored non-target subreddit" };
  }

  const barePostId = bareThingId(postId);
  const storedAuthorName = authorName ?? (await getStoredPostAuthor(barePostId));

  if (!storedAuthorName) {
    return {
      untracked: false,
      reason: "missing author payload for deleted post",
    };
  }

  const entries = await getCompletionEntries(storedAuthorName);
  const removed = entries.filter(
    ({ item }) => bareThingId(item.postId) === barePostId,
  );

  if (removed.length === 0) {
    const completed = await getCompletedItems(storedAuthorName);
    const body = await buildUserHistoryComment(storedAuthorName, completed);
    await updateExistingHistoryComment(barePostId, body);
    return { untracked: false, reason: "deleted post was not tracked as an item" };
  }

  await deleteCompletionEntries(storedAuthorName, removed.map(({ key }) => key));
  await clearPostAuthor(barePostId);

  const affectedPostIds = new Set<string>([
    barePostId,
    ...entries.map(({ item }) => bareThingId(item.postId)),
  ]);
  const completed = await getCompletedItems(storedAuthorName);
  const body = await buildUserHistoryComment(storedAuthorName, completed);

  await Promise.all(
    [...affectedPostIds].map((affectedPostId) =>
      updateExistingHistoryComment(affectedPostId, body),
    ),
  );

  return { untracked: true };
}

/**
 * Reacts to moderator actions in the installed subreddit. A mod removing the bot's
 * history comment permanently deletes it (and clears its tracking); a mod removing a
 * tracked post untracks it via the same path as an author deletion. Note that mod
 * removals fire `onModAction` ("removelink"), never `onPostDelete`.
 */
export async function handleTriggerModAction(
  action: string | undefined,
  targetCommentId: string | undefined,
  targetPostId: string | undefined,
  subredditName: string | undefined,
): Promise<{ handled: boolean; reason?: string }> {
  if (!isInstalledSubreddit(subredditName)) {
    return { handled: false, reason: "ignored non-target subreddit" };
  }

  if (action === "removecomment" && targetCommentId) {
    const deleted = await deleteBotHistoryComment(targetCommentId);
    return {
      handled: deleted,
      reason: deleted ? undefined : "not a bot history comment",
    };
  }

  if (action === "removelink" && targetPostId) {
    const result = await removeCompletionForDeletedPost(
      targetPostId,
      undefined,
      subredditName,
    );
    return { handled: result.untracked, reason: result.reason };
  }

  return { handled: false, reason: `unhandled mod action: ${action ?? "?"}` };
}

export async function trackTriggerPostAndComment(
  post: PostV2 | undefined,
  authorName: string | undefined,
  subredditName: string | undefined,
): Promise<TrackPostResult> {
  if (!post) return { tracked: false, reason: "missing post payload" };
  if (subredditName && !isInstalledSubreddit(subredditName)) {
    return { tracked: false, reason: "ignored non-target subreddit" };
  }

  const canonicalPost = await reddit.getPostById(thingId(post.id, "t3") as T3);
  if (!isInstalledSubreddit(canonicalPost.subredditName)) {
    return { tracked: false, reason: "ignored non-target subreddit" };
  }
  if (
    authorName &&
    normalizeUsername(canonicalPost.authorName) !== normalizeUsername(authorName)
  ) {
    return { tracked: false, reason: "post author did not match event author" };
  }
  const trackingRule = await trackedFlairRuleForText(canonicalPost.flair?.text);
  if (!trackingRule) {
    return { tracked: false, reason: "flair is not configured for tracking" };
  }

  const trackedItem = resolveTrackedItemFromTitle(
    canonicalPost.title,
    trackingRule,
  );

  const completed = completionFromPost(
    canonicalPost,
    trackedItem,
    trackingRule.trackContributors,
  );
  await saveCompletion(completed);

  // When automatic commenting is disabled, we still track the contribution and
  // keep existing comments fresh, but we never create a new comment: skip
  // queuing this post for the backfill upsert and skip the direct upsert below.
  const autoComment = await isAutoCommentEnabled();

  if (autoComment) {
    await addPendingHistoryPost(canonicalPost.authorName, canonicalPost.id, subredditName);
  }
  const backfillRunning = await startBackfillUser(
    canonicalPost.authorName,
    subredditName,
  );
  if (backfillRunning) {
    return { tracked: true, item: completed };
  }

  const body = await refreshKnownHistoryComments(canonicalPost.authorName);
  if (autoComment) {
    await upsertHistoryComment(canonicalPost.id, body);
  }

  return { tracked: true, item: completed };
}

/**
 * Manually posts (or refreshes) the post author's contribution-history comment on
 * the given post. Triggered by the moderator post menu action, this deliberately
 * bypasses the `autoComment` setting and works even when the post itself is not a
 * tracked flair, so mods can surface a user's history on demand.
 */
export async function postHistoryCommentForPost(
  postId: string,
): Promise<{ ok: boolean; reason: string }> {
  const post = await reddit.getPostById(thingId(postId, "t3") as T3);
  if (!isInstalledSubreddit(post.subredditName)) {
    return { ok: false, reason: "This post is not in the tracked subreddit." };
  }

  const completed = await getCompletedItems(post.authorName);
  const body = await buildUserHistoryComment(post.authorName, completed);
  await upsertHistoryComment(bareThingId(post.id), body);

  return {
    ok: true,
    reason: completed.length
      ? `Posted contribution history for u/${post.authorName}.`
      : `Posted history comment for u/${post.authorName} (no contributions tracked yet).`,
  };
}

export type ReviewView = {
  tracked: boolean;
  trackContributors: boolean;
  postTitle: string;
  currentName?: string;
  currentContributors: string[];
  sentences: string[];
};

/**
 * Gathers what the "Review contribution" form needs for a post: whether the
 * post's flair is tracked, its mode (sentence vs username), the post title, the
 * currently stored contribution name/contributors, and the flair's configured
 * title sentences to choose from.
 */
export async function getReviewView(postId: string): Promise<ReviewView> {
  const barePostId = bareThingId(postId);
  const post = await reddit.getPostById(thingId(barePostId, "t3") as T3);
  const empty: ReviewView = {
    tracked: false,
    trackContributors: false,
    postTitle: post.title,
    currentContributors: [],
    sentences: [],
  };
  if (!isInstalledSubreddit(post.subredditName)) {
    return empty;
  }

  const rule = await trackedFlairRuleForText(post.flair?.text);
  if (!rule) {
    return empty;
  }

  const entries = await getCompletionEntries(post.authorName);
  const entry = entries.find(({ item }) => bareThingId(item.postId) === barePostId);

  return {
    tracked: true,
    trackContributors: rule.trackContributors,
    postTitle: post.title,
    currentName: entry?.item.name,
    currentContributors: entry?.item.contributors ?? [],
    sentences: rule.matchSentences,
  };
}

/**
 * Moderator post-menu action: sets the contribution title for a post (clearing
 * the "needs review" flag), or removes the contribution entirely when `title`
 * is null. Re-renders the author's history comments to reflect the change.
 */
export async function setContributionTitleForPost(
  postId: string,
  title: string | null,
  moderator?: string,
): Promise<{ ok: boolean; reason: string }> {
  if (!(await isModerator(moderator))) {
    return { ok: false, reason: "Setting a contribution title is moderator-only." };
  }

  if (title === null) {
    const result = await removeCompletionForPost(postId);
    return result.untracked
      ? { ok: true, reason: "Contribution removed." }
      : { ok: false, reason: result.reason ?? "This post was not tracked as a contribution." };
  }

  const barePostId = bareThingId(postId);
  const post = await reddit.getPostById(thingId(barePostId, "t3") as T3);
  if (!isInstalledSubreddit(post.subredditName)) {
    return { ok: false, reason: "This post is not in the tracked subreddit." };
  }

  const entries = await getCompletionEntries(post.authorName);
  const entry = entries.find(({ item }) => bareThingId(item.postId) === barePostId);
  if (!entry) {
    return { ok: false, reason: "No tracked contribution found for this post." };
  }

  await saveCompletion({
    ...entry.item,
    name: title,
    trackContributors: false,
    needsReview: false,
  });

  const body = await refreshKnownHistoryComments(post.authorName);
  await updateExistingHistoryComment(barePostId, body);

  return { ok: true, reason: `Contribution title set to "${title}".` };
}

/**
 * Moderator post-menu action for username-mode (requested-by) posts: replaces
 * the contribution's linked usernames and clears the "needs review" flag.
 * Removal is intentionally not offered here — removing the flair uncategorizes
 * the post via the flair-update path.
 */
export async function setRequestedByUsersForPost(
  postId: string,
  usernames: string[],
  moderator?: string,
): Promise<{ ok: boolean; reason: string }> {
  if (!(await isModerator(moderator))) {
    return { ok: false, reason: "Setting requested-by users is moderator-only." };
  }

  const barePostId = bareThingId(postId);
  const post = await reddit.getPostById(thingId(barePostId, "t3") as T3);
  if (!isInstalledSubreddit(post.subredditName)) {
    return { ok: false, reason: "This post is not in the tracked subreddit." };
  }

  const entries = await getCompletionEntries(post.authorName);
  const entry = entries.find(({ item }) => bareThingId(item.postId) === barePostId);
  if (!entry) {
    return { ok: false, reason: "No tracked contribution found for this post." };
  }

  await saveCompletion({
    ...entry.item,
    contributors: usernames,
    trackContributors: true,
    needsReview: false,
  });

  const body = await refreshKnownHistoryComments(post.authorName);
  await updateExistingHistoryComment(barePostId, body);

  return {
    ok: true,
    reason: usernames.length
      ? `Linked ${usernames.length} requested-by user(s).`
      : "Cleared requested-by users.",
  };
}

export async function handleTriggerPostFlairUpdate(
  post: PostV2 | undefined,
  authorName: string | undefined,
  subredditName: string | undefined,
): Promise<TrackPostResult | UntrackPostResult> {
  if (!post) return { untracked: false, reason: "missing post payload" };
  if (subredditName && !isInstalledSubreddit(subredditName)) {
    return { untracked: false, reason: "ignored non-target subreddit" };
  }

  if (await trackedFlairRuleForText(post.linkFlair?.text)) {
    return trackTriggerPostAndComment(post, undefined, subredditName);
  }

  if (!post.linkFlair?.text) {
    const canonicalPost = await reddit.getPostById(thingId(post.id, "t3") as T3);
    if (!isInstalledSubreddit(canonicalPost.subredditName)) {
      return { untracked: false, reason: "ignored non-target subreddit" };
    }
    if (await trackedFlairRuleForText(canonicalPost.flair?.text)) {
      return trackTriggerPostAndComment(post, undefined, canonicalPost.subredditName);
    }
  }

  return removeCompletionForPost(post.id);
}

export type TrackingMode = "sentences" | "usernames";

export type TrackingConfigView = {
  flairTemplates: string[];
  trackedRules: {
    flairText: string;
    trackContributors: boolean;
    matchSentences: string[];
  }[];
  removableFlairs: string[];
};

/**
 * Gathers everything the config modal needs: the subreddit's post flair
 * templates, the currently effective rules (for display), and the manually
 * configured flairs that can be untracked.
 */
export async function getTrackingConfigView(): Promise<TrackingConfigView> {
  const sub = getInstalledSubredditName();
  const templates = await reddit.getPostFlairTemplates(sub);
  const flairTemplates = [
    ...new Set(
      templates
        .map((template) => template.text?.trim())
        .filter((text): text is string => Boolean(text)),
    ),
  ];

  const trackedRules = (await fetchTrackedFlairRules(sub)).map((rule) => ({
    flairText: rule.flairText,
    trackContributors: rule.trackContributors,
    matchSentences: rule.matchSentences,
  }));

  const removableFlairs = (await listManualTrackedFlairRules(sub)).map(
    (rule) => rule.flairText,
  );

  return { flairTemplates, trackedRules, removableFlairs };
}

/**
 * Applies one config-modal submission: upserts a manual rule for each selected
 * flair (with the chosen mode + sentences) and removes any flairs marked for
 * untracking. Other tracked flairs are left untouched.
 */
export async function applyTrackingConfig(
  input: {
    flairs: string[];
    mode: TrackingMode;
    sentences: string[];
    untrack: string[];
  },
  configuredBy?: string,
): Promise<{ ok: boolean; reason: string }> {
  if (!(await isModerator(configuredBy))) {
    return { ok: false, reason: "Configuration is moderator-only." };
  }

  const sub = getInstalledSubredditName();
  const trackContributors = input.mode === "usernames";

  const flairs = input.flairs.map((flair) => flair.trim()).filter(Boolean);
  for (const flairText of flairs) {
    const rule = makeManualTrackedFlairRule({
      flairText,
      trackContributors,
      matchSentences: trackContributors ? [] : input.sentences,
    });
    await upsertManualTrackedFlairRule(rule, sub);
  }

  let removed = 0;
  for (const flairText of input.untrack) {
    if (await removeManualTrackedFlairRule(flairText, sub)) removed++;
  }

  if (flairs.length === 0 && removed === 0) {
    return { ok: false, reason: "No flairs were selected to track or untrack." };
  }

  const parts: string[] = [];
  if (flairs.length > 0) {
    parts.push(
      `tracking ${flairs.length} flair(s) in ${trackContributors ? "username" : "sentence"} mode`,
    );
  }
  if (removed > 0) parts.push(`removed ${removed} flair rule(s)`);

  return { ok: true, reason: `Saved: ${parts.join("; ")}.` };
}

export async function scanUserItems(
  username: string,
  limit: number = DEFAULT_SCAN_LIMIT,
  subredditName?: string,
): Promise<UserItemsResult> {
  const cleanUsername = normalizeUsername(username);
  const cleanSubredditName = (subredditName ?? getInstalledSubredditName()).toLowerCase();
  const posts = await reddit
    .getPostsByUser({
      username: cleanUsername,
      sort: "new",
      timeframe: "all",
      limit,
      pageSize: 100,
    })
    .all();

  for (const post of posts) {
    if (
      cleanSubredditName &&
      post.subredditName.toLowerCase() !== cleanSubredditName
    ) {
      continue;
    }
    const trackingRule = await trackedFlairRuleForText(post.flair?.text, cleanSubredditName);
    if (!trackingRule) continue;

    const trackedItem = resolveTrackedItemFromTitle(post.title, trackingRule);

    await saveCompletion(completionFromPost(post, trackedItem, trackingRule.trackContributors));
  }

  const completed = await getCompletedItems(cleanUsername);
  await setUserSyncMeta(
    cleanUsername,
    subredditName,
    limit,
    completed.length,
  );

  return {
    type: "userItems",
    username: cleanUsername,
    count: completed.length,
    items: completed,
  };
}

export async function getUserItems(
  username: string,
  refresh: boolean,
  limit?: number,
): Promise<UserItemsResult> {
  if (refresh) {
    return scanUserItems(username, limit);
  }

  const cleanUsername = normalizeUsername(username);
  const completed = await getCompletedItems(cleanUsername);
  return {
    type: "userItems",
    username: cleanUsername,
    count: completed.length,
    items: completed,
  };
}

export { runBackfillChunk };
export type { BackfillTaskData };
