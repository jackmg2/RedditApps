import { describe, expect, it } from "vitest";
import {
  computeStreak,
  renderStreakWikiSection,
  renderStreakZone,
  streakRank,
  utcDay,
  type StreakView,
} from "../../src/server/tracking/streak.ts";

const DAY = 86_400;
// 2023-11-14 00:00:00 UTC
const TODAY = utcDay(1_699_920_000);

/** A timestamp `daysAgo` days before TODAY, at `hour` UTC. */
function at(daysAgo: number, hour = 12): number {
  return (TODAY - daysAgo) * DAY + hour * 3600;
}

function view(overrides: Partial<StreakView>): StreakView {
  return { length: 5, asOfDay: TODAY, ...overrides };
}

describe("computeStreak", () => {
  it("counts consecutive active days ending today", () => {
    expect(computeStreak([at(0), at(1), at(2)], TODAY, 0)).toEqual({
      length: 3,
      lastDay: TODAY,
    });
  });

  it("counts several contributions on the same day once", () => {
    expect(computeStreak([at(0, 1), at(0, 23), at(1)], TODAY, 0).length).toBe(2);
  });

  it("stays alive when the last contribution was yesterday", () => {
    expect(computeStreak([at(1), at(2)], TODAY, 0).length).toBe(2);
  });

  it("breaks when no contribution was made today or yesterday", () => {
    expect(computeStreak([at(2), at(3)], TODAY, 0)).toEqual({
      length: 0,
      lastDay: TODAY - 2,
    });
  });

  it("stops at the first gap", () => {
    expect(computeStreak([at(0), at(1), at(3), at(4)], TODAY, 0).length).toBe(2);
  });

  it("bridges gaps up to the grace days without counting them", () => {
    expect(computeStreak([at(0), at(2), at(4)], TODAY, 1).length).toBe(3);
    expect(computeStreak([at(0), at(3)], TODAY, 1).length).toBe(1);
  });

  it("widens the alive window by the grace days", () => {
    expect(computeStreak([at(3), at(4)], TODAY, 2).length).toBe(2);
    expect(computeStreak([at(4), at(5)], TODAY, 2).length).toBe(0);
  });

  it("returns no streak without contributions", () => {
    expect(computeStreak([], TODAY, 0)).toEqual({ length: 0 });
  });

  it("uses UTC day boundaries", () => {
    // 23:59 two days ago and 00:01 yesterday are consecutive days.
    const late = (TODAY - 1) * DAY - 60;
    const early = (TODAY - 1) * DAY + 60;
    expect(computeStreak([late, early], TODAY, 0).length).toBe(2);
  });
});

describe("streakRank", () => {
  it("competition-ranks ties", () => {
    expect(streakRank(7, [9, 7, 7, 4])).toEqual({ rank: 2, total: 4 });
    expect(streakRank(4, [9, 7, 7, 4])).toEqual({ rank: 4, total: 4 });
  });
});

describe("renderStreakZone", () => {
  const labels = { title: "Contribution streak", emoji: "🔥" };

  it("renders the title, one emoji per day, the rank and the date", () => {
    const lines = renderStreakZone(
      "alice",
      view({ length: 5, rank: { rank: 2, total: 7 } }),
      labels,
    );
    expect(lines).toEqual([
      "### Contribution streak",
      "",
      "🔥🔥🔥🔥🔥 **5 days**",
      "",
      "u/alice is #2 of 7 current streakers.",
      "",
      "*As of 2023-11-14 (UTC).*",
    ]);
  });

  it("caps the emojis at 30 and shows the remainder", () => {
    const lines = renderStreakZone("alice", view({ length: 42 }), labels);
    expect(lines[2]).toBe(`${"🔥".repeat(30)} +12 **42 days**`);
  });

  it("omits the rank line below three days", () => {
    const lines = renderStreakZone(
      "alice",
      view({ length: 2, rank: { rank: 1, total: 1 } }),
      labels,
    );
    expect(lines.join("\n")).not.toContain("streakers");
    expect(lines[2]).toBe("🔥🔥 **2 days**");
  });

  it("renders nothing for a streak shorter than two days", () => {
    expect(renderStreakZone("alice", view({ length: 1 }), labels)).toEqual([]);
    expect(renderStreakZone("alice", view({ length: 0 }), labels)).toEqual([]);
  });

  it("uses the configured title and emoji", () => {
    const lines = renderStreakZone("alice", view({ length: 3 }), {
      title: "Baking streak",
      emoji: "🧁",
    });
    expect(lines[0]).toBe("### Baking streak");
    expect(lines[2]).toBe("🧁🧁🧁 **3 days**");
  });
});

describe("renderStreakWikiSection", () => {
  it("renders a ranked table with shared ranks for ties", () => {
    const lines = renderStreakWikiSection([
      { member: "alice", days: 9 },
      { member: "bob", days: 9 },
      { member: "carol", days: 4 },
    ]);
    expect(lines).toEqual([
      "## Current streaks",
      "",
      "| Rank | Member | Days |",
      "|---|---|---|",
      "| 1 | u/alice | 9 |",
      "| 1 | u/bob | 9 |",
      "| 3 | u/carol | 4 |",
    ]);
  });

  it("says so when nobody has an active streak", () => {
    expect(renderStreakWikiSection([])).toEqual([
      "## Current streaks",
      "",
      "*No active streaks right now.*",
    ]);
  });
});
