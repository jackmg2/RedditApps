import type { CompletedContribution } from "./types.ts";

export function mergeCompletion(
  existing: CompletedContribution | undefined,
  incoming: CompletedContribution,
): CompletedContribution {
  return {
    ...existing,
    ...incoming,
  };
}
