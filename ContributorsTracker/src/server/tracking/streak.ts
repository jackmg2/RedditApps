import {
  MIN_STREAK_DISPLAY_DAYS,
  MIN_STREAKER_DAYS,
  STREAK_EMOJI_CAP,
} from "./config.ts";

const SECONDS_PER_DAY = 86_400;

/** A member's current contribution streak. */
export type Streak = {
  /** Active (contribution) days in the current run; 0 when the streak is broken. */
  length: number;
  /** UTC day number of the latest active day, or undefined with no contributions. */
  lastDay?: number;
};

/** The member's place among active streakers (competition ranked). */
export type StreakRank = {
  rank: number;
  total: number;
};

export type StreakView = {
  length: number;
  /** UTC day number the view was computed on. */
  asOfDay: number;
  /** Present only when the member is a streaker ({@link MIN_STREAKER_DAYS}+ days). */
  rank?: StreakRank;
};

/** Moderator-configurable wording for the streak zone. */
export type StreakLabels = {
  title: string;
  emoji: string;
};

export const DEFAULT_STREAK_LABELS: StreakLabels = {
  title: "Contribution streak",
  emoji: "🔥",
};

export type StreakEntry = {
  member: string;
  days: number;
};

/** UTC day number (days since the epoch) of a unix timestamp in seconds. */
export function utcDay(unixSeconds: number): number {
  return Math.floor(unixSeconds / SECONDS_PER_DAY);
}

function formatDay(day: number): string {
  return new Date(day * SECONDS_PER_DAY * 1000).toISOString().slice(0, 10);
}

/**
 * A streak is alive while the latest active day is within `grace + 1` days of
 * today: with no grace, a contribution today or yesterday keeps it going.
 */
export function isStreakAlive(
  lastDay: number,
  todayDay: number,
  graceDays: number,
): boolean {
  return todayDay - lastDay <= graceDays + 1;
}

/**
 * Computes the current streak from contribution timestamps: walks back from the
 * latest active day while consecutive active days are at most `grace + 1` days
 * apart. Only active days count toward the length; bridged grace days don't.
 */
export function computeStreak(
  createdUtcs: number[],
  todayDay: number,
  graceDays: number,
): Streak {
  const days = [...new Set(createdUtcs.map(utcDay))].sort((a, b) => b - a);
  const lastDay = days[0];
  if (lastDay === undefined) return { length: 0 };
  if (!isStreakAlive(lastDay, todayDay, graceDays)) return { length: 0, lastDay };

  let length = 1;
  for (let i = 1; i < days.length; i++) {
    if (days[i - 1]! - days[i]! > graceDays + 1) break;
    length++;
  }

  return { length, lastDay };
}

/** Competition rank ("1224") of `days` among `allDays` (which includes it). */
export function streakRank(days: number, allDays: number[]): StreakRank {
  const higher = allDays.filter((other) => other > days).length;
  return { rank: higher + 1, total: allDays.length };
}

function emojiProgress(emoji: string, length: number): string {
  const shown = Math.min(length, STREAK_EMOJI_CAP);
  const progress = emoji.repeat(shown);
  return length > shown ? `${progress} +${length - shown}` : progress;
}

/**
 * The streak zone shown under the history comment's intro line, or no lines
 * while the streak is shorter than {@link MIN_STREAK_DISPLAY_DAYS}. The ranking
 * line only appears for streakers ({@link MIN_STREAKER_DAYS}+ days).
 */
export function renderStreakZone(
  username: string,
  view: StreakView,
  labels: StreakLabels = DEFAULT_STREAK_LABELS,
): string[] {
  if (view.length < MIN_STREAK_DISPLAY_DAYS) return [];

  const lines = [
    `### ${labels.title}`,
    "",
    `${emojiProgress(labels.emoji, view.length)} **${view.length} days**`,
  ];

  if (view.length >= MIN_STREAKER_DAYS && view.rank) {
    lines.push(
      "",
      `u/${username} is #${view.rank.rank} of ${view.rank.total} current streakers.`,
    );
  }

  lines.push("", `*As of ${formatDay(view.asOfDay)} (UTC).*`);
  return lines;
}

/** The "Current streaks" part of the leaderboard wiki page (competition ranks). */
export function renderStreakWikiSection(entries: StreakEntry[]): string[] {
  const lines = ["## Current streaks", ""];
  if (entries.length === 0) {
    lines.push("*No active streaks right now.*");
    return lines;
  }

  lines.push("| Rank | Member | Days |", "|---|---|---|");
  let rank = 0;
  let previousDays: number | undefined;
  for (const [index, entry] of entries.entries()) {
    if (entry.days !== previousDays) {
      rank = index + 1;
      previousDays = entry.days;
    }
    lines.push(`| ${rank} | u/${entry.member} | ${entry.days} |`);
  }

  return lines;
}
