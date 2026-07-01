import { describe, expect, it } from "vitest";
import { mergeCompletion } from "../../src/server/tracking/completion-domain.ts";
import { completionRecordKey } from "../../src/server/tracking/redis-keys.ts";
import type { CompletedContribution } from "../../src/server/tracking/types.ts";

function completed(overrides: Partial<CompletedContribution> = {}): CompletedContribution {
  return {
    name: "Heartboob",
    level: "Beginner",
    postId: "t3_abc123",
    title: "Original title",
    url: "https://www.reddit.com/r/test/comments/abc123/title/",
    createdUtc: 1_700_000_000,
    flair: "CommunityContribution",
    author: "example",
    contributors: [],
    ...overrides,
  };
}

describe("completion records", () => {
  it("keys completions by post id", () => {
    expect(completionRecordKey(completed())).toBe("abc123");
  });

  it("overlays incoming fields on the existing record", () => {
    const merged = mergeCompletion(
      completed({ title: "Original title", contributors: ["alice"] }),
      completed({ title: "Updated title" }),
    );

    expect(merged).toMatchObject({
      title: "Updated title",
      contributors: [],
    });
  });

  it("clears the needs-review flag when an incoming record sets it false", () => {
    const merged = mergeCompletion(
      completed({ needsReview: true }),
      completed({ name: "open source", needsReview: false }),
    );

    expect(merged).toMatchObject({ name: "open source", needsReview: false });
  });
});
