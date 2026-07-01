import { describe, expect, it } from "vitest";
import {
  matchSentenceFromTitle,
  resolveTrackedItemFromTitle,
} from "../../src/server/tracking/contribution-matching.ts";
import type { TrackedFlairRule } from "../../src/server/tracking/types.ts";

function rule(overrides: Partial<TrackedFlairRule> = {}): TrackedFlairRule {
  return {
    flairText: "CommunityContribution",
    normalizedFlairText: "communitycontribution",
    trackContributors: false,
    matchSentences: [],
    source: "manual",
    ...overrides,
  };
}

describe("matchSentenceFromTitle", () => {
  it("matches a configured sentence ignoring case and punctuation", () => {
    expect(
      matchSentenceFromTitle("[CommunityContribution] Made an OPEN-SOURCE tool!", [
        "open source",
      ]),
    ).toBe("open source");
  });

  it("returns undefined when no sentence matches", () => {
    expect(matchSentenceFromTitle("Totally unrelated title", ["open source"])).toBeUndefined();
  });

  it("chooses the longest matching sentence", () => {
    expect(
      matchSentenceFromTitle("Shipped an open source library today", [
        "open source",
        "open source library",
      ]),
    ).toBe("open source library");
  });

  it("only matches on whole words, not substrings", () => {
    expect(matchSentenceFromTitle("opensourced everything", ["open"])).toBeUndefined();
  });
});

describe("resolveTrackedItemFromTitle", () => {
  it("tracks every post in username mode using the cleaned title", () => {
    const item = resolveTrackedItemFromTitle(
      "Sunny day requestedby u/example",
      rule({ trackContributors: true, flairText: "REQUESTED BY" }),
    );

    expect(item).toMatchObject({ name: "Sunny day", level: "REQUESTED BY" });
  });

  it("tracks every post when sentence mode has no configured sentences", () => {
    const item = resolveTrackedItemFromTitle("Anything goes here", rule());
    expect(item).toMatchObject({ name: "Anything goes here", level: "CommunityContribution" });
  });

  it("uses the matched sentence as the name and does not flag it for review", () => {
    const sentenceRule = rule({ matchSentences: ["open source"] });

    expect(resolveTrackedItemFromTitle("Built an open source app", sentenceRule)).toMatchObject({
      name: "open source",
      level: "CommunityContribution",
      needsReview: false,
    });
  });

  it("optimistically tracks a sentence-mode post that matches nothing, flagging it for review", () => {
    const sentenceRule = rule({ matchSentences: ["open source"] });

    expect(resolveTrackedItemFromTitle("Built a closed app", sentenceRule)).toMatchObject({
      name: "Built a closed app",
      level: "CommunityContribution",
      needsReview: true,
    });
  });

  it("does not flag username-mode posts that mention a user in the title", () => {
    expect(
      resolveTrackedItemFromTitle(
        "Sunny day requestedby u/example",
        rule({ trackContributors: true, flairText: "REQUESTED BY" }),
      ),
    ).toMatchObject({ name: "Sunny day", needsReview: false });
  });

  it("flags username-mode posts with no user mention in the title", () => {
    expect(
      resolveTrackedItemFromTitle(
        "Sunny day with nobody tagged",
        rule({ trackContributors: true, flairText: "REQUESTED BY" }),
      ),
    ).toMatchObject({ needsReview: true });
  });

  it("does not flag empty-sentence mode", () => {
    expect(resolveTrackedItemFromTitle("Anything goes here", rule())).toMatchObject({
      needsReview: false,
    });
  });
});
