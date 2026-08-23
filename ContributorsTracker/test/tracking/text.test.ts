import { describe, expect, it } from "vitest";
import {
  applyTemplate,
  communityContributionNameFromTitle,
  extractContributors,
  extractrequestedBy,
  hasContributorUser,
  hasrequestedByUser,
  normalizeText,
  parseUsernameList,
} from "../../src/server/tracking/text.ts";

describe("CommunityContribution text helpers", () => {
  it("normalizes text for forgiving matching", () => {
    expect(normalizeText("Truth & Contribution by u/Someone!!!")).toBe("truth and contribution by");
  });

  it("extracts every u/ mention, with or without a requested-by phrase", () => {
    expect(
      extractrequestedBy("Sunny requestedby u/Alice and shoutout to /u/Bob"),
    ).toEqual(["Alice", "Bob"]);
    expect(extractContributors("Bare mention of u/Charlie")).toEqual(["Charlie"]);
  });

  it("dedupes and sorts contributors", () => {
    expect(
      extractContributors("requested by u/Bob and u/Alice and u/Bob again"),
    ).toEqual(["Alice", "Bob"]);
  });

  it("does not match u/ inside other words", () => {
    expect(extractContributors("check the menu/settings page")).toEqual([]);
  });

  it("detects whether a post has a user mention", () => {
    expect(hasrequestedByUser("requested by u/example")).toBe(true);
    expect(hasrequestedByUser("just u/Example here")).toBe(true);
    expect(hasrequestedByUser("no mention at all")).toBe(false);
    expect(hasContributorUser("/u/example")).toBe(true);
  });

  it("parses a moderator-entered username list", () => {
    expect(parseUsernameList("u/Alice, /u/Bob charlie")).toEqual(["Alice", "Bob", "charlie"]);
    expect(parseUsernameList("u/dave\nu/dave\ndave")).toEqual(["dave"]);
    expect(parseUsernameList("  ")).toEqual([]);
  });

  it("strips u/ mentions (with or without requested-by) from contribution names", () => {
    expect(communityContributionNameFromTitle("Sunny day - requested by /u/example"))
      .toBe("Sunny day");
    expect(communityContributionNameFromTitle("Cool build u/example")).toBe("Cool build");
    expect(communityContributionNameFromTitle("requestedby u/example")).toBe("requestedby u/example");
  });

  it("applies {placeholder} templates", () => {
    expect(applyTemplate("u/{name} is top {percent}%", { name: "Alice", percent: 12 }))
      .toBe("u/Alice is top 12%");
    expect(applyTemplate("{a} and {a}", { a: "again" })).toBe("again and again");
    expect(applyTemplate("known {a}, unknown {b}", { a: 1 })).toBe("known 1, unknown {b}");
    expect(applyTemplate("no tokens", { a: 1 })).toBe("no tokens");
  });
});
