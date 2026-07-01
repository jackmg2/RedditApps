import { fetchTrackedFlairRules } from "./flair-rule-store.ts";
import type { TrackedFlairRule } from "./types.ts";

export function normalizeFlairText(flair: string | undefined): string {
  return (flair ?? "").trim().toLowerCase();
}

export async function trackedFlairRuleForText(
  flair: string | undefined,
  subredditName?: string,
): Promise<TrackedFlairRule | undefined> {
  const normalized = normalizeFlairText(flair);
  if (!normalized) return undefined;

  const rules = await fetchTrackedFlairRules(subredditName);
  return rules.find((rule) => normalized.includes(rule.normalizedFlairText));
}

export async function isTrackedFlair(flair: string | undefined): Promise<boolean> {
  return (await trackedFlairRuleForText(flair)) !== undefined;
}
