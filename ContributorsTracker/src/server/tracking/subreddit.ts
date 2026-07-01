import { context } from "@devvit/web/server";

/**
 * Resolves the subreddit the app is installed in from the current request
 * context. Available for trigger and menu (request-scoped) handlers; scheduler
 * tasks must instead pass the subreddit name carried on their payload.
 */
export function getInstalledSubredditName(): string {
  const name = context.subredditName;
  if (!name) {
    throw new Error("Subreddit context is unavailable");
  }
  return name;
}

export function isInstalledSubreddit(name: string | undefined): boolean {
  return (
    !!name && name.toLowerCase() === getInstalledSubredditName().toLowerCase()
  );
}
