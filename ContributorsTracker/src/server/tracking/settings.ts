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
    standingTop,
    standingNeutral,
    membersNoun,
  ] = await Promise.all([
    getLabel("labelContributionsTitle", DEFAULT_HISTORY_LABELS.contributionsTitle),
    getLabel("labelMembersTitle", DEFAULT_HISTORY_LABELS.membersTitle),
    getLabel("labelIntroPrefix", DEFAULT_HISTORY_LABELS.introPrefix),
    getLabel("labelContributionHeader", DEFAULT_HISTORY_LABELS.contributionHeader),
    getLabel("labelRequestedByHeader", DEFAULT_HISTORY_LABELS.requestedByHeader),
    getLabel("labelStandingTop", DEFAULT_HISTORY_LABELS.standingTop),
    getLabel("labelStandingNeutral", DEFAULT_HISTORY_LABELS.standingNeutral),
    getLabel("membersNoun", DEFAULT_HISTORY_LABELS.membersNoun),
  ]);

  return {
    contributionsTitle,
    membersTitle,
    introPrefix,
    contributionHeader,
    requestedByHeader,
    standingTop,
    standingNeutral,
    membersNoun,
  };
}

/** What the community calls its members ("bakers", "artists", ...). */
export async function getMembersNoun(): Promise<string> {
  return getLabel("membersNoun", DEFAULT_HISTORY_LABELS.membersNoun);
}

/**
 * Whether history comments include the member's leaderboard standing line.
 * Defaults to on.
 */
export async function isStandingLineEnabled(): Promise<boolean> {
  const value = await settings.get<boolean>("showStanding");
  return value ?? true;
}

/**
 * Whether the app maintains the leaderboard wiki page. Defaults to on; the
 * page is only ever created lazily, on the first tracked contribution.
 */
export async function isWikiLeaderboardEnabled(): Promise<boolean> {
  const value = await settings.get<boolean>("enableWikiLeaderboard");
  return value ?? true;
}

const DEFAULT_WIKI_LEADERBOARD_PAGE = "contributors-leaderboard";

export async function getWikiLeaderboardPageName(): Promise<string> {
  const raw = await getLabel("wikiLeaderboardPage", DEFAULT_WIKI_LEADERBOARD_PAGE);
  const clean = raw
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_/-]/g, "");
  return clean || DEFAULT_WIKI_LEADERBOARD_PAGE;
}
