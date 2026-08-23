import { buildHistoryComment } from "./history-renderer.ts";
import { getLeaderboardStanding } from "./leaderboard-store.ts";
import { getHistoryLabels, isStandingLineEnabled } from "./settings.ts";
import type { CompletedContribution } from "./types.ts";

/**
 * Builds a history-comment body using the subreddit's configured wording and,
 * when enabled, the author's leaderboard standing. Shared by the service and
 * the backfill job (which must not import from service.ts).
 */
export async function buildUserHistoryCommentBody(
  username: string,
  completed: CompletedContribution[],
): Promise<string> {
  const labels = await getHistoryLabels();
  const standing = (await isStandingLineEnabled())
    ? await getLeaderboardStanding(username, completed.length)
    : undefined;

  return buildHistoryComment(username, completed, labels, standing);
}
