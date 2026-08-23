import { describe, expect, it } from "vitest";
import {
  renderLeaderboardWikiMarkdown,
  renderStandingLine,
  topPercent,
  type LeaderboardStanding,
  type StandingLabels,
} from "../../src/server/tracking/leaderboard.ts";

function standing(overrides: Partial<LeaderboardStanding>): LeaderboardStanding {
  return { count: 3, totalMembers: 10, strictlyHigherCount: 0, ...overrides };
}

const labels: StandingLabels = {
  standingTop: "u/{username} is in the top {percent}% of our {members}!",
  standingNeutral: "Contributions tracked so far: {count}.",
  membersNoun: "members",
};

describe("topPercent", () => {
  it("computes the competition-ranked percentile", () => {
    expect(topPercent(standing({ strictlyHigherCount: 0, totalMembers: 10 }))).toBe(10);
    expect(topPercent(standing({ strictlyHigherCount: 4, totalMembers: 10 }))).toBe(50);
    expect(topPercent(standing({ strictlyHigherCount: 5, totalMembers: 10 }))).toBe(60);
  });

  it("puts a sole member at 100%", () => {
    expect(topPercent(standing({ strictlyHigherCount: 0, totalMembers: 1 }))).toBe(100);
  });

  it("returns 100% for an empty index", () => {
    expect(topPercent(standing({ totalMembers: 0 }))).toBe(100);
  });

  it("gives tied members the same percentile", () => {
    const a = standing({ count: 4, strictlyHigherCount: 2, totalMembers: 20 });
    const b = standing({ count: 4, strictlyHigherCount: 2, totalMembers: 20 });
    expect(topPercent(a)).toBe(topPercent(b));
  });
});

describe("renderStandingLine", () => {
  it("renders the top wording for the top half", () => {
    const line = renderStandingLine(
      "Alice",
      standing({ count: 5, totalMembers: 10, strictlyHigherCount: 0 }),
      labels,
    );
    expect(line).toBe("u/Alice is in the top 10% of our members!");
  });

  it("renders the top wording at exactly the 50% threshold", () => {
    const line = renderStandingLine(
      "Alice",
      standing({ totalMembers: 10, strictlyHigherCount: 4 }),
      labels,
    );
    expect(line).toBe("u/Alice is in the top 50% of our members!");
  });

  it("renders the neutral wording below the top half", () => {
    const line = renderStandingLine(
      "Alice",
      standing({ count: 1, totalMembers: 10, strictlyHigherCount: 6 }),
      labels,
    );
    expect(line).toBe("Contributions tracked so far: 1.");
  });

  it("stays neutral while the index has fewer than five members, even at rank 1", () => {
    const line = renderStandingLine(
      "Alice",
      standing({ count: 3, totalMembers: 2, strictlyHigherCount: 0 }),
      labels,
    );
    expect(line).toBe("Contributions tracked so far: 3.");
  });

  it("renders no line for a member with no contributions", () => {
    expect(renderStandingLine("Alice", standing({ count: 0 }), labels)).toBeUndefined();
  });

  it("substitutes every placeholder in custom wording", () => {
    const line = renderStandingLine(
      "Alice",
      standing({ count: 7, totalMembers: 20, strictlyHigherCount: 1 }),
      {
        standingTop: "{username}: top {percent}% with {count} of {total} {members}",
        standingNeutral: "unused",
        membersNoun: "bakers",
      },
    );
    expect(line).toBe("Alice: top 10% with 7 of 20 bakers");
  });

  it("fills {members} with the community's own noun", () => {
    const line = renderStandingLine(
      "Alice",
      standing({ count: 5, totalMembers: 10, strictlyHigherCount: 0 }),
      { ...labels, membersNoun: "artists" },
    );
    expect(line).toBe("u/Alice is in the top 10% of our artists!");
  });

  it("leaves unknown placeholders untouched", () => {
    const line = renderStandingLine("Alice", standing({}), {
      standingTop: "top {percent}% {unknown}",
      standingNeutral: "unused",
      membersNoun: "members",
    });
    expect(line).toBe("top 10% {unknown}");
  });
});

describe("renderLeaderboardWikiMarkdown", () => {
  it("renders a ranked table with competition ranks for ties", () => {
    const markdown = renderLeaderboardWikiMarkdown(
      [
        { member: "alice", score: 7 },
        { member: "bob", score: 7 },
        { member: "carol", score: 5 },
      ],
      25,
      1_700_000_000_000,
    );

    expect(markdown).toContain("# Contributors Leaderboard");
    expect(markdown).toContain("| Rank | Member | Contributions |");
    expect(markdown).toContain("| 1 | u/alice | 7 |");
    expect(markdown).toContain("| 1 | u/bob | 7 |");
    expect(markdown).toContain("| 3 | u/carol | 5 |");
    expect(markdown).toContain(
      "*25 members indexed. Updated 2023-11-14T22:13:20.000Z. Maintained automatically by contributorstracker.*",
    );
  });

  it("renders an empty table without rows", () => {
    const markdown = renderLeaderboardWikiMarkdown([], 0, 1_700_000_000_000);
    expect(markdown).toContain("|---|---|---|");
    expect(markdown).toContain("*0 members indexed.");
    expect(markdown).not.toContain("| u/");
  });

  it("uses the community's members noun in the footer", () => {
    const markdown = renderLeaderboardWikiMarkdown(
      [{ member: "alice", score: 7 }],
      25,
      1_700_000_000_000,
      "bakers",
    );
    expect(markdown).toContain("*25 bakers indexed.");
    // The title and table header keep their fixed wording.
    expect(markdown).toContain("# Contributors Leaderboard");
    expect(markdown).toContain("| Rank | Member | Contributions |");
  });
});
