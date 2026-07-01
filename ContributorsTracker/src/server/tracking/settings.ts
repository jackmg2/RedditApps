import { settings } from "@devvit/web/server";
import {
  DEFAULT_HISTORY_LABELS,
  type HistoryLabels,
} from "./history-renderer.ts";

/**
 * Whether the app should create the contribution-history comment when a post is
 * tracked. Configured via the subreddit app setting; defaults to true (on) so
 * existing installs keep their current behavior until a moderator opts out.
 */
export async function isAutoCommentEnabled(): Promise<boolean> {
  const value = await settings.get<boolean>("autoComment");
  return value ?? true;
}

/** Reads a string setting, falling back to `fallback` when unset or blank. */
async function getLabel(key: string, fallback: string): Promise<string> {
  const value = await settings.get<string>(key);
  return (value ?? "").trim() || fallback;
}

/**
 * Reads the moderator-configurable wording for the contribution-history
 * comment. Each blank/unset field falls back to {@link DEFAULT_HISTORY_LABELS}.
 */
export async function getHistoryLabels(): Promise<HistoryLabels> {
  const [
    contributionsTitle,
    membersTitle,
    introPrefix,
    contributionHeader,
    requestedByHeader,
  ] = await Promise.all([
    getLabel("labelContributionsTitle", DEFAULT_HISTORY_LABELS.contributionsTitle),
    getLabel("labelMembersTitle", DEFAULT_HISTORY_LABELS.membersTitle),
    getLabel("labelIntroPrefix", DEFAULT_HISTORY_LABELS.introPrefix),
    getLabel("labelContributionHeader", DEFAULT_HISTORY_LABELS.contributionHeader),
    getLabel("labelRequestedByHeader", DEFAULT_HISTORY_LABELS.requestedByHeader),
  ]);

  return {
    contributionsTitle,
    membersTitle,
    introPrefix,
    contributionHeader,
    requestedByHeader,
  };
}
