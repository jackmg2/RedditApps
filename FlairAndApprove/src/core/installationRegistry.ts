import { redis } from '@devvit/web/server';

// Registry of subreddits where this app is installed, kept in app-global
// redis so any installation can offer cross-subreddit approval. Populated by
// the AppInstall trigger and self-healed from menu handlers (covers subs
// installed before this registry existed). Devvit has no uninstall trigger,
// so stale entries are tolerated: they are filtered out by per-sub permission
// checks and surface as per-sub failures at approval time.
const INSTALLATIONS_KEY = 'installations';

export async function registerInstallation(subredditName: string | undefined): Promise<void> {
  if (!subredditName) return;
  try {
    await redis.global.hSet(INSTALLATIONS_KEY, { [subredditName]: '1' });
  } catch (error) {
    console.error(`Failed to register installation for r/${subredditName}:`, error);
  }
}

export async function getInstalledSubreddits(): Promise<string[]> {
  try {
    return await redis.global.hKeys(INSTALLATIONS_KEY);
  } catch (error) {
    console.error('Failed to list installations:', error);
    return [];
  }
}
