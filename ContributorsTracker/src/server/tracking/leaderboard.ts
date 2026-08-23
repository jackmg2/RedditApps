import {
  MIN_LEADERBOARD_MEMBERS,
  STANDING_TOP_PERCENT_THRESHOLD,
} from "./config.ts";
import { applyTemplate } from "./text.ts";

/** A member's position in the contribution leaderboard. */
export type LeaderboardStanding = {
  /** The member's tracked-contribution count. */
  count: number;
  /** Total members currently in the leaderboard index. */
  totalMembers: number;
  /** Members with a strictly higher contribution count. */
  strictlyHigherCount: number;
};

export type LeaderboardEntry = {
  member: string;
  score: number;
};

/** Wording for the standing line; a structural subset of HistoryLabels. */
export type StandingLabels = {
  standingTop: string;
  standingNeutral: string;
  membersNoun: string;
};

/**
 * Competition-ranked ("1224") top percentile: every member tied on a count
 * shares the best rank of their group, so equal counts never yield different
 * percentiles.
 */
export function topPercent(standing: LeaderboardStanding): number {
  if (standing.totalMembers <= 0) return 100;
  return Math.ceil(
    ((standing.strictlyHigherCount + 1) / standing.totalMembers) * 100,
  );
}

/**
 * The standing line for a history comment: the "top {percent}%" wording for the
 * top half of members, a neutral count line otherwise. The percentile wording
 * is suppressed while the index holds fewer than {@link MIN_LEADERBOARD_MEMBERS}
 * members so a half-migrated install never brags about a near-empty ranking.
 */
export function renderStandingLine(
  username: string,
  standing: LeaderboardStanding,
  labels: StandingLabels,
): string | undefined {
  if (standing.count <= 0) return undefined;

  const vars = {
    username,
    count: standing.count,
    total: standing.totalMembers,
    percent: topPercent(standing),
    members: labels.membersNoun,
  };
  const template =
    vars.percent <= STANDING_TOP_PERCENT_THRESHOLD &&
    standing.totalMembers >= MIN_LEADERBOARD_MEMBERS
      ? labels.standingTop
      : labels.standingNeutral;

  return applyTemplate(template, vars);
}

/** Renders the full-ranking wiki page with competition ranks (ties share one). */
export function renderLeaderboardWikiMarkdown(
  entries: LeaderboardEntry[],
  totalMembers: number,
  updatedAtUtcMs: number,
  membersNoun = "members",
): string {
  const lines = [
    "# Contributors Leaderboard",
    "",
    "| Rank | Member | Contributions |",
    "|---|---|---|",
  ];

  let rank = 0;
  let previousScore: number | undefined;
  for (const [index, entry] of entries.entries()) {
    if (entry.score !== previousScore) {
      rank = index + 1;
      previousScore = entry.score;
    }
    lines.push(`| ${rank} | u/${entry.member} | ${entry.score} |`);
  }

  const updatedAt = new Date(updatedAtUtcMs).toISOString();
  lines.push(
    "",
    `*${totalMembers} ${membersNoun} indexed. Updated ${updatedAt}. Maintained automatically by contributorstracker.*`,
  );

  return lines.join("\n");
}
