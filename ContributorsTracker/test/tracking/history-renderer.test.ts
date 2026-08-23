import { describe, expect, it } from "vitest";
import {
  buildHistoryComment,
  type HistoryLabels,
} from "../../src/server/tracking/history-renderer.ts";
import type { CompletedContribution } from "../../src/server/tracking/types.ts";

function completed(overrides: Partial<CompletedContribution>): CompletedContribution {
  return {
    name: "Heartboob",
    level: "Beginner",
    postId: "abc123",
    title: "Heartboob",
    url: "https://www.reddit.com/r/test/comments/abc123/title/",
    createdUtc: 1_700_000_000,
    flair: "CommunityContribution",
    author: "example",
    contributors: [],
    ...overrides,
  };
}

describe("history comment rendering", () => {
  it("renders separate CommunityContribution and Community tables", () => {
    const body = buildHistoryComment("example", [
      completed({ name: "Heartboob", flair: "CommunityContribution" }),
      completed({
        name: "Sunny day",
        title: "Sunny day requestedby u/Alice",
        flair: "REQUESTED BY",
        trackContributors: true,
        contributors: ["Alice"],
        postId: "community1",
      }),
    ]);

    expect(body).toContain("## Contributions");
    expect(body).toContain("## Members Contributions");
    expect(body).toContain("| Date | Contribution | requested by |");
    expect(body).toContain("Contributions history for example");
    expect(body).toContain(
      "| 2023-11-14 | [Sunny day](https://www.reddit.com/r/test/comments/abc123/title/) | Alice |",
    );
    expect(body).not.toContain("Contributions history for u/example");
  });

  it("renders moderator-customised wording when labels are provided", () => {
    const labels: HistoryLabels = {
      contributionsTitle: "Community contributions",
      membersTitle: "Member submissions",
      introPrefix: "Submission log for",
      contributionHeader: "Submission",
      requestedByHeader: "on behalf of",
      standingTop: "u/{username} is in the top {percent}% of our {members}!",
      standingNeutral: "Contributions tracked so far: {count}.",
      membersNoun: "members",
    };

    const body = buildHistoryComment(
      "example",
      [
        completed({ name: "Heartboob", flair: "CommunityContribution" }),
        completed({
          name: "Sunny day",
          flair: "REQUESTED BY",
          trackContributors: true,
          contributors: ["Alice"],
          postId: "community1",
        }),
      ],
      labels,
    );

    expect(body).toContain("Submission log for example");
    expect(body).toContain("## Community contributions");
    expect(body).toContain("## Member submissions");
    expect(body).toContain("| Date | Submission |");
    expect(body).toContain("| Date | Submission | on behalf of |");
    // Default wording no longer appears once custom labels are supplied.
    expect(body).not.toContain("## Contributions");
    expect(body).not.toContain("Contributions history for");
  });

  it("routes manually-configured flairs by tracking mode, not flair text", () => {
    const body = buildHistoryComment("example", [
      completed({
        name: "Sentence contribution",
        flair: "Test flair",
        trackContributors: false,
        postId: "manual-sentence",
      }),
      completed({
        name: "Username contribution",
        flair: "Test flair",
        trackContributors: true,
        contributors: ["Bob"],
        postId: "manual-username",
      }),
    ]);

    const [contributionsSection, membersSection] = body.split(
      "## Members Contributions",
    );

    // Sentence-mode manual flair lands in the contributions table.
    expect(contributionsSection).toContain(
      "[Sentence contribution](https://www.reddit.com/r/test/comments/abc123/title/)",
    );
    // Username-mode manual flair lands in the members table with its user.
    expect(membersSection).toContain(
      "| 2023-11-14 | [Username contribution](https://www.reddit.com/r/test/comments/abc123/title/) | Bob |",
    );
    // Neither table falls back to the empty placeholder.
    expect(body).not.toContain("No contributions found yet");
  });

  it("links contribution names", () => {
    const body = buildHistoryComment("example", [
      completed({
        name: "Name with | pipe",
      }),
    ]);

    expect(body).toContain("[Name with \\| pipe](https://www.reddit.com/r/test/comments/abc123/title/)");
  });

  it("marks contributions needing review and adds a legend", () => {
    const body = buildHistoryComment("example", [
      completed({ name: "Built a closed app", needsReview: true }),
    ]);

    expect(body).toContain(
      "[Built a closed app](https://www.reddit.com/r/test/comments/abc123/title/) ⚠️",
    );
    expect(body).toContain("⚠️ = PENDING REVIEW");
  });

  it("omits the review legend when nothing needs review", () => {
    const body = buildHistoryComment("example", [completed({ needsReview: false })]);
    expect(body).not.toContain("⚠️");
  });

  it("shows five newest rows and puts older rows below", () => {
    const body = buildHistoryComment(
      "example",
      Array.from({ length: 6 }, (_, index) =>
        completed({
          name: `Contribution ${index + 1}`,
          title: `Post ${index + 1}`,
          postId: `post${index + 1}`,
          createdUtc: 1_700_000_000 + index,
        }),
      ),
    );

    expect(body).toContain("Older contributions: 1 more stored.");
    expect(body).not.toContain("| 2023-11-14 | [Contribution 1]");
    expect(body).toContain("| 2023-11-14 | [Contribution 6]");
  });

  it("inserts the standing line below the intro, keeping line 1 unchanged", () => {
    const body = buildHistoryComment("example", [completed({})], undefined, {
      count: 1,
      totalMembers: 10,
      strictlyHigherCount: 1,
    });

    const lines = body.split("\n");
    // Line 1 identifies the app's own comments; it must never change.
    expect(lines[0]).toBe("Contributions history for example");
    expect(lines[1]).toBe("");
    expect(lines[2]).toBe("u/example is in the top 20% of our members!");
    expect(lines[3]).toBe("");
    expect(lines[4]).toBe("## Contributions");
  });

  it("renders the neutral standing line below the top half", () => {
    const body = buildHistoryComment("example", [completed({})], undefined, {
      count: 1,
      totalMembers: 10,
      strictlyHigherCount: 6,
    });

    expect(body.split("\n")[2]).toBe("Contributions tracked so far: 1.");
  });

  it("renders identically to before when no standing is provided", () => {
    const without = buildHistoryComment("example", [completed({})]);
    const withUndefined = buildHistoryComment(
      "example",
      [completed({})],
      undefined,
      undefined,
    );

    expect(withUndefined).toBe(without);
    expect(without).not.toContain("top");
  });
});
