import { reddit } from '@devvit/web/server';
import * as storageService from './storageService.js';
import * as modNoteService from './modNoteService.js';
import { getInstalledSubreddits } from './installationRegistry.js';

export type MultiSubApprovalResult = {
  approved: string[];
  failed: Array<{ sub: string; error: string }>;
};

/**
 * Subreddits (other than `excludeSub`) where this app is installed and the
 * current user moderates with the 'access' permission. Fails closed per sub:
 * any lookup error excludes that sub.
 */
export async function getEligibleSubreddits(excludeSub: string): Promise<string[]> {
  const installed = await getInstalledSubreddits();
  const candidates = installed.filter(
    (sub) => sub.toLowerCase() !== excludeSub.toLowerCase()
  );
  if (candidates.length === 0) return [];

  const user = await reddit.getCurrentUser();
  if (!user) return [];

  const checks = await Promise.allSettled(
    candidates.map(async (sub) => {
      const permissions = await user.getModPermissionsForSubreddit(sub);
      return permissions.includes('all') || permissions.includes('access') ? sub : undefined;
    })
  );

  return checks
    .map((r) => (r.status === 'fulfilled' ? r.value : undefined))
    .filter((sub): sub is string => Boolean(sub));
}

/**
 * Approves a user in each subreddit, mirroring the current-sub approval path
 * (approve + timestamp + optional mod note). Permission checks are the
 * caller's responsibility.
 */
export async function approveUserInSubreddits(
  username: string,
  subs: string[],
  options: { addModNote: boolean; isBulk: boolean }
): Promise<MultiSubApprovalResult> {
  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      await reddit.approveUser(username, sub);
      await storageService.storeApprovalTimestamp(username, sub);
      if (options.addModNote) {
        await modNoteService.addApprovalNote(username, sub, options.isBulk);
      }
      return sub;
    })
  );

  const approved: string[] = [];
  const failed: Array<{ sub: string; error: string }> = [];
  results.forEach((r, i) => {
    const sub = subs[i]!;
    if (r.status === 'fulfilled') {
      approved.push(sub);
    } else {
      failed.push({ sub, error: r.reason instanceof Error ? r.reason.message : 'Unknown error' });
    }
  });

  return { approved, failed };
}
