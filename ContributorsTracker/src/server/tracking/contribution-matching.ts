import type { TrackedItem, TrackedFlairRule } from "./types.ts";
import {
  communityContributionNameFromTitle,
  extractContributors,
  normalizeText,
} from "./text.ts";

/**
 * Returns the longest configured sentence that appears in the title (matched on
 * normalized, word-boundary-padded text), or undefined when none match.
 */
export function matchSentenceFromTitle(
  title: string,
  sentences: string[],
): string | undefined {
  const normalizedTitle = ` ${normalizeText(title)} `;
  const matches: { sentence: string; length: number }[] = [];

  for (const sentence of sentences) {
    const normalizedSentence = normalizeText(sentence);
    if (!normalizedSentence) continue;
    if (normalizedTitle.includes(` ${normalizedSentence} `)) {
      matches.push({ sentence, length: normalizedSentence.length });
    }
  }

  return matches.sort((a, b) => b.length - a.length)[0]?.sentence;
}

export function resolveTrackedItemFromTitle(
  title: string,
  trackingRule: TrackedFlairRule,
): TrackedItem {
  // Username mode: every flaired post is tracked; the item name comes from the
  // title with the u/ mentions stripped. Flag for review when the title carries
  // no username so a mod can add the requested-by users from the post menu.
  if (trackingRule.trackContributors) {
    return {
      name: communityContributionNameFromTitle(title),
      level: trackingRule.flairText,
      aliases: [],
      needsReview: extractContributors(title).length === 0,
    };
  }

  // Sentence mode with no configured sentences: track every post with the flair.
  if (trackingRule.matchSentences.length === 0) {
    return {
      name: communityContributionNameFromTitle(title),
      level: trackingRule.flairText,
      aliases: [],
      needsReview: false,
    };
  }

  // Sentence mode with configured sentences. When one matches, use it as the
  // canonical contribution name so identical contributions group together.
  // Otherwise classify optimistically: still track the post (best-guess name
  // from the title) but flag it so a mod can set the proper title.
  const matched = matchSentenceFromTitle(title, trackingRule.matchSentences);

  return {
    name: matched ?? communityContributionNameFromTitle(title),
    level: trackingRule.flairText,
    aliases: [],
    needsReview: matched === undefined,
  };
}
