import { redis } from "@devvit/web/server";
import { getInstalledSubredditName } from "./subreddit.ts";
import { trackedFlairRulesOverridesKey } from "./redis-keys.ts";
import type { TrackedFlairRule } from "./types.ts";

function normalizeFlairText(flairText: string): string {
  return flairText.trim().toLowerCase();
}

function normalizeStoredRule(rule: TrackedFlairRule): TrackedFlairRule {
  return {
    flairText: rule.flairText,
    normalizedFlairText: rule.normalizedFlairText,
    trackContributors: rule.trackContributors,
    matchSentences: rule.matchSentences ?? [],
    source: "manual",
  };
}

export function makeManualTrackedFlairRule(input: {
  flairText: string;
  trackContributors: boolean;
  matchSentences: string[];
}): TrackedFlairRule {
  return {
    flairText: input.flairText.trim(),
    normalizedFlairText: normalizeFlairText(input.flairText),
    trackContributors: input.trackContributors,
    matchSentences: input.matchSentences
      .map((sentence) => sentence.trim())
      .filter(Boolean),
    source: "manual",
  };
}

export async function listManualTrackedFlairRules(
  subredditName?: string,
): Promise<TrackedFlairRule[]> {
  const records = await redis.hGetAll(trackedFlairRulesOverridesKey(subredditName));
  return Object.values(records)
    .map((value) => normalizeStoredRule(JSON.parse(value) as TrackedFlairRule))
    .sort((a, b) => a.flairText.localeCompare(b.flairText));
}

/**
 * Resolves the effective tracked-flair rules: the moderator-configured manual
 * rules for the subreddit.
 */
export async function fetchTrackedFlairRules(
  subredditName?: string,
): Promise<TrackedFlairRule[]> {
  return listManualTrackedFlairRules(subredditName ?? getInstalledSubredditName());
}

export async function upsertManualTrackedFlairRule(
  rule: TrackedFlairRule,
  subredditName?: string,
): Promise<void> {
  await redis.hSet(trackedFlairRulesOverridesKey(subredditName), {
    [rule.normalizedFlairText]: JSON.stringify({ ...rule, source: "manual" }),
  });
}

export async function removeManualTrackedFlairRule(
  flairText: string,
  subredditName?: string,
): Promise<boolean> {
  const normalized = normalizeFlairText(flairText);
  if (!normalized) return false;

  const removed = await redis.hDel(trackedFlairRulesOverridesKey(subredditName), [normalized]);
  return removed > 0;
}
