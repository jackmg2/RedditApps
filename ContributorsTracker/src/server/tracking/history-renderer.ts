import { HISTORY_TABLE_LIMIT } from "./config.ts";
import type { CompletedContribution } from "./types.ts";

/**
 * User-facing wording for the contribution-history comment. Moderators can
 * override each string via subreddit App Settings; blank fields fall back to the
 * defaults below.
 */
export interface HistoryLabels {
  /** Heading of the first table (contributions the user made). */
  contributionsTitle: string;
  /** Heading of the second table (contributions requested by members). */
  membersTitle: string;
  /** Intro line prefix, rendered as `${introPrefix} ${username}`. */
  introPrefix: string;
  /** Shared "item" column header in both tables. */
  contributionHeader: string;
  /** "requested by" column header in the members table. */
  requestedByHeader: string;
}

export const DEFAULT_HISTORY_LABELS: HistoryLabels = {
  contributionsTitle: "Contributions",
  membersTitle: "Members Contributions",
  introPrefix: "Contributions history for",
  contributionHeader: "Contribution",
  requestedByHeader: "requested by",
};

/**
 * Whether a completion belongs in the username/requested-by table, based on the
 * mode persisted on the record.
 */
function isUsernameMode(contribution: CompletedContribution): boolean {
  return contribution.trackContributors === true;
}

function escapeTableCell(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim() || "-";
}

function escapeLinkText(value: string): string {
  return escapeTableCell(value).replace(/\]/g, "\\]");
}

function formatUsernames(usernames: string[]): string {
  if (usernames.length === 0) return "-";

  return usernames.join(", ");
}

function formatDate(createdUtc: number): string {
  return new Date(createdUtc * 1000).toISOString().slice(0, 10);
}

const NEEDS_REVIEW_MARKER = "⚠️";

const NEEDS_REVIEW_LEGEND =
  `${NEEDS_REVIEW_MARKER} = PENDING REVIEW`;

function contributionLink(contribution: CompletedContribution): string {
  const link = `[${escapeLinkText(contribution.name)}](${contribution.url})`;
  return contribution.needsReview ? `${link} ${NEEDS_REVIEW_MARKER}` : link;
}

function newestFirst(contributions: CompletedContribution[]): CompletedContribution[] {
  return [...contributions].sort(
    (a, b) => b.createdUtc - a.createdUtc || a.name.localeCompare(b.name),
  );
}

export function renderCommunityContributionTable(
  title: string,
  contributions: CompletedContribution[],
  labels: HistoryLabels = DEFAULT_HISTORY_LABELS,
): string[] {
  const sorted = newestFirst(contributions);
  const visible = sorted.slice(0, HISTORY_TABLE_LIMIT);
  const older = sorted.slice(HISTORY_TABLE_LIMIT);
  const lines = [
    `## ${title}`,
    "",
    `| Date | ${labels.contributionHeader} |`,
    "|---|---|",
  ];

  if (visible.length === 0) {
    lines.push("| - | No contributions found yet |");
  }

  for (const contribution of visible) {
    const cells = [
      formatDate(contribution.createdUtc),
      contributionLink(contribution),
    ];
    lines.push(`| ${cells.join(" | ")} |`);
  }

  if (older.length > 0) {
    lines.push("", `Older ${title.toLowerCase()}: ${older.length} more stored.`);
  }

  return lines;
}

export function renderCommunityTable(
  title: string,
  contributions: CompletedContribution[],
  labels: HistoryLabels = DEFAULT_HISTORY_LABELS,
): string[] {
  const sorted = newestFirst(contributions);
  const visible = sorted.slice(0, HISTORY_TABLE_LIMIT);
  const older = sorted.slice(HISTORY_TABLE_LIMIT);
  const lines = [
    `## ${title}`,
    "",
    `| Date | ${labels.contributionHeader} | ${labels.requestedByHeader} |`,
    "|---|---|---|",
  ];

  if (visible.length === 0) {
    lines.push("| - | No contributions found yet | - |");
  }

  for (const contribution of visible) {
    const cells = [
      formatDate(contribution.createdUtc),
      contributionLink(contribution),
      escapeTableCell(formatUsernames(contribution.contributors ?? [])),
    ];
    lines.push(`| ${cells.join(" | ")} |`);
  }

  if (older.length > 0) {
    lines.push("", `Older ${title.toLowerCase()}: ${older.length} more stored.`);
  }

  return lines;
}

export function buildHistoryComment(
  username: string,
  completed: CompletedContribution[],
  labels: HistoryLabels = DEFAULT_HISTORY_LABELS,
): string {
  const contributionContributions = completed.filter(
    (contribution) => !isUsernameMode(contribution),
  );
  const communityContributions = completed.filter((contribution) =>
    isUsernameMode(contribution),
  );
  const lines = [
    `${labels.introPrefix} ${username}`,
    "",
    ...renderCommunityContributionTable(labels.contributionsTitle, contributionContributions, labels),
    "",
    ...renderCommunityTable(labels.membersTitle, communityContributions, labels),
    ""
  ];

  if (completed.some((contribution) => contribution.needsReview)) {
    lines.push("", NEEDS_REVIEW_LEGEND);
  }

  return lines.join("\n");
}
