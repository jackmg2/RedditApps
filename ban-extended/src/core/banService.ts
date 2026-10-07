import { reddit } from '@devvit/web/server';
import type { T1, T3 } from '@devvit/shared-types/tid.js';
import { mergeBanRecord, writeBanRecord, getBanRecord, deleteBanRecord } from './banRecord.js';

interface ContentItem {
  id: string;
  subredditName: string;
  createdAt: Date;
}

interface TimeFilters {
  'last 24 hours': number;
  'previous 3 days': number;
  'previous 7 days': number;
  'all time': number;
}

const TIME_FILTERS: TimeFilters = {
  'last 24 hours': 86_400_000,
  'previous 3 days': 259_200_000,
  'previous 7 days': 604_800_000,
  'all time': Infinity,
};

export type BanInput = {
  subredditName: string;
  username: string;
  banDuration: number | undefined;
  /** Rule title; becomes Reddit's 100-char ban reason. */
  ruleViolated: string;
  /** Message sent to the banned user, placeholders already resolved. */
  banMessage: string;
  /** Mod-only note (300 chars max), placeholders already resolved. */
  banNote: string;
  removeContent: string;
  lockPosts: boolean;
  muteUser: boolean;
  markAsSpam: boolean;
};

export type BulkBanInput = {
  subredditName: string;
  usernames: string;
  banDuration: number | undefined;
  ruleViolated: string;
  banMessage: string;
  banNote: string;
  removeContent: string;
  lockPosts: boolean;
  muteUser: boolean;
  markAsSpam: boolean;
};

export type BulkBanResult = {
  successCount: number;
  errorCount: number;
  errors: string[];
};

// Reddit's ban has three texts: `reason` (100 chars, shown in the ban list and mod log),
// `message` (sent to the user) and `note` (300 chars, mods only).
export async function banUser(input: BanInput): Promise<void> {
  await reddit.banUser({
    subredditName: input.subredditName,
    username: input.username,
    reason: `${input.ruleViolated}`.substring(0, 100),
    message: input.banMessage,
    ...(input.banNote ? { note: input.banNote } : {}),
    ...(input.banDuration !== undefined ? { duration: input.banDuration } : {}),
  });
}

export type RemovedContent = {
  removedPostIds: string[];
  removedCommentIds: string[];
};

export async function removeUserContent(
  username: string,
  subredditName: string,
  markAsSpam: boolean,
  timePeriod: string
): Promise<RemovedContent> {
  const [allPosts, allComments] = await Promise.all([
    reddit.getPostsByUser({ username }).all(),
    reddit.getCommentsByUser({ username }).all(),
  ]);

  const postsToRemove = filterBySubredditAndTime(
    allPosts.map((p) => ({ id: p.id, subredditName: p.subredditName, createdAt: p.createdAt })),
    subredditName,
    timePeriod
  );

  const commentsToRemove = filterBySubredditAndTime(
    allComments.map((c) => ({ id: c.id, subredditName: c.subredditName, createdAt: c.createdAt })),
    subredditName,
    timePeriod
  );

  // allSettled so one failure doesn't abort the batch or record an id that wasn't removed
  const [postResults, commentResults] = await Promise.all([
    Promise.allSettled(postsToRemove.map((item) => reddit.remove(item.id as T3, markAsSpam))),
    Promise.allSettled(commentsToRemove.map((item) => reddit.remove(item.id as T1, markAsSpam))),
  ]);

  return {
    removedPostIds: postsToRemove.filter((_, i) => postResults[i]?.status === 'fulfilled').map((item) => item.id),
    removedCommentIds: commentsToRemove.filter((_, i) => commentResults[i]?.status === 'fulfilled').map((item) => item.id),
  };
}

export async function lockUserPosts(username: string, subredditName: string): Promise<string[]> {
  const allPosts = await reddit.getPostsByUser({ username }).all();
  const postsToLock = allPosts.filter((p) => p.subredditName === subredditName && !p.locked);
  const results = await Promise.allSettled(postsToLock.map((p) => p.lock()));
  return postsToLock.filter((_, i) => results[i]?.status === 'fulfilled').map((p) => p.id);
}

/** Mutes the user from the subreddit's modmail. Reddit mutes last 28 days and Reddit notifies the user. */
export async function muteUser(username: string, subredditName: string, ruleViolated: string): Promise<void> {
  await reddit.muteUser({
    subredditName,
    username,
    ...(ruleViolated ? { note: ruleViolated.substring(0, 100) } : {}),
  });
}

export async function processBan(input: BanInput): Promise<string> {
  let errorDuringBan = false;
  let errorDuringRemoval = false;
  let errorDuringLock = false;
  let errorDuringMute = false;
  let errorMessage = '';

  try {
    await banUser(input);
  } catch (error) {
    errorMessage = `Error banning ${input.username}: ${error}`;
    console.error(errorMessage);
    errorDuringBan = true;
  }

  let removed: RemovedContent = { removedPostIds: [], removedCommentIds: [] };
  let lockedPostIds: string[] = [];

  if (!errorDuringBan && input.removeContent !== 'Do not remove') {
    try {
      removed = await removeUserContent(input.username, input.subredditName, input.markAsSpam, input.removeContent);
    } catch (error) {
      errorMessage = `Error removing ${input.username}'s content: ${error}`;
      console.error(errorMessage);
      errorDuringRemoval = true;
    }
  }

  if (!errorDuringBan && input.lockPosts) {
    try {
      lockedPostIds = await lockUserPosts(input.username, input.subredditName);
    } catch (error) {
      errorMessage = `Error locking ${input.username}'s posts: ${error}`;
      console.error(errorMessage);
      errorDuringLock = true;
    }
  }

  let muted = false;
  if (!errorDuringBan && input.muteUser) {
    try {
      await muteUser(input.username, input.subredditName, input.ruleViolated);
      muted = true;
    } catch (error) {
      errorMessage = `Error muting ${input.username}: ${error}`;
      console.error(errorMessage);
      errorDuringMute = true;
    }
  }

  if (!errorDuringBan) {
    await trackBanActions(input.subredditName, input.username, removed, lockedPostIds, muted, input.markAsSpam);
  }

  if (errorDuringBan || errorDuringRemoval || errorDuringLock || errorDuringMute) return errorMessage;
  return buildSuccessMessage(input.username, input.removeContent, input.lockPosts, input.muteUser);
}

export async function processBulkBan(input: BulkBanInput): Promise<BulkBanResult> {
  const usernameList = parseUsernameList(input.usernames);
  let successCount = 0;
  const errors: string[] = [];

  for (const username of usernameList) {
    let errorDuringBan = false;

    try {
      await reddit.banUser({
        subredditName: input.subredditName,
        username,
        reason: `${input.ruleViolated}`.substring(0, 100),
        message: input.banMessage,
        ...(input.banNote ? { note: input.banNote } : {}),
        ...(input.banDuration !== undefined ? { duration: input.banDuration } : {}),
      });
    } catch (error) {
      errorDuringBan = true;
      errors.push(`${username} (ban): ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    let removed: RemovedContent = { removedPostIds: [], removedCommentIds: [] };
    let lockedPostIds: string[] = [];

    if (!errorDuringBan && input.removeContent !== 'Do not remove') {
      try {
        removed = await removeUserContent(username, input.subredditName, input.markAsSpam, input.removeContent);
      } catch (error) {
        errors.push(`${username} (removal): ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (!errorDuringBan && input.lockPosts) {
      try {
        lockedPostIds = await lockUserPosts(username, input.subredditName);
      } catch (error) {
        errors.push(`${username} (lock): ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    let muted = false;
    if (!errorDuringBan && input.muteUser) {
      try {
        await muteUser(username, input.subredditName, input.ruleViolated);
        muted = true;
      } catch (error) {
        errors.push(`${username} (mute): ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (!errorDuringBan) {
      await trackBanActions(input.subredditName, username, removed, lockedPostIds, muted, input.markAsSpam);
      successCount++;
    }
  }

  return { successCount, errorCount: errors.length, errors };
}

// Tracking failures must never fail the ban itself.
export async function trackBanActions(
  subredditName: string,
  username: string,
  removed: RemovedContent,
  lockedPostIds: string[],
  muted: boolean,
  markAsSpam: boolean
): Promise<void> {
  const total = removed.removedPostIds.length + removed.removedCommentIds.length + lockedPostIds.length;
  if (total === 0 && !muted) return;
  try {
    await mergeBanRecord(subredditName, username, {
      removedPostIds: removed.removedPostIds,
      removedCommentIds: removed.removedCommentIds,
      lockedPostIds,
      muted,
      bannedAt: Date.now(),
      markAsSpam,
    });
  } catch (error) {
    console.error(`Failed to save ban record for ${username}: ${error}`);
  }
}

export type UnbanInput = {
  subredditName: string;
  username: string;
  restoreContent: boolean;
  unlockPosts: boolean;
  unmuteUser: boolean;
};

export type RestoreResult = {
  hadRecord: boolean;
  approved: number;
  unlocked: number;
  /** True when the app had muted the user and the unmute succeeded. */
  unmuted: boolean;
  failed: number;
};

export async function processUnban(input: UnbanInput): Promise<string> {
  // If the unban itself fails, let the error propagate — nothing else should happen.
  await reddit.unbanUser(input.username, input.subredditName);

  const result = await restoreRecordedContent(input);
  return [`✅ ${input.username} has been unbanned.`, ...describeRestore(result, input)].join(' ');
}

/** Turns a restore result into toast sentences; shared by Undo Ban and Undo Shadowban. */
export function describeRestore(result: RestoreResult, input: UnbanInput): string[] {
  if (!result.hadRecord) {
    return [
      'No restore data exists for this ban (made before undo tracking was added, or expired), so no content was re-approved or unlocked and the user was not unmuted.',
    ];
  }
  const parts: string[] = [];
  if (input.restoreContent) parts.push(`Re-approved ${result.approved} item(s).`);
  if (input.unlockPosts) parts.push(`Unlocked ${result.unlocked} post(s).`);
  if (result.unmuted) parts.push('Unmuted from modmail.');
  if (result.failed > 0) parts.push(`${result.failed} item(s) could not be restored (possibly deleted).`);
  return parts;
}

/** Re-approves, unlocks and unmutes what this app recorded at ban time, then trims the record. */
export async function restoreRecordedContent(input: UnbanInput): Promise<RestoreResult> {
  const record = await getBanRecord(input.subredditName, input.username);
  if (!record) {
    return { hadRecord: false, approved: 0, unlocked: 0, unmuted: false, failed: 0 };
  }

  let approved = 0;
  let unlocked = 0;
  let unmuted = false;
  let failed = 0;

  if (input.restoreContent) {
    const ids = [...record.removedPostIds, ...record.removedCommentIds];
    const results = await Promise.allSettled(ids.map((id) => reddit.approve(id as T1 | T3)));
    approved = results.filter((r) => r.status === 'fulfilled').length;
    failed += results.length - approved;
    // Retrying author-deleted content never succeeds, so clear attempted ids regardless.
    record.removedPostIds = [];
    record.removedCommentIds = [];
  }

  if (input.unlockPosts) {
    const results = await Promise.allSettled(
      record.lockedPostIds.map(async (id) => (await reddit.getPostById(id as T3)).unlock())
    );
    unlocked = results.filter((r) => r.status === 'fulfilled').length;
    failed += results.length - unlocked;
    record.lockedPostIds = [];
  }

  if (input.unmuteUser && record.muted) {
    try {
      await reddit.unmuteUser(input.username, input.subredditName);
      unmuted = true;
    } catch (error) {
      console.error(`Failed to unmute ${input.username}: ${error}`);
      failed += 1;
    }
    // Reddit mutes expire on their own after 28 days, so never retry a failed unmute.
    record.muted = false;
  }

  try {
    const remaining =
      record.removedPostIds.length + record.removedCommentIds.length + record.lockedPostIds.length;
    if (remaining === 0 && !record.muted) {
      await deleteBanRecord(input.subredditName, input.username);
    } else {
      // Keep the un-restored remainder so a later undo can still restore it.
      await writeBanRecord(input.subredditName, input.username, record);
    }
  } catch (error) {
    console.error(`Failed to update ban record for ${input.username}: ${error}`);
  }

  return { hadRecord: true, approved, unlocked, unmuted, failed };
}

export function parseUsernameList(input: string): string[] {
  return input
    .split(/[;,]/)
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

function filterBySubredditAndTime(items: ContentItem[], subredditName: string, timePeriod: string) {
  const now = Date.now();
  const timeLimit = TIME_FILTERS[timePeriod as keyof TimeFilters] ?? 0;
  return items.filter(
    (item) => item.subredditName === subredditName && now - new Date(item.createdAt).getTime() <= timeLimit
  );
}

export function buildSuccessMessage(
  username: string,
  removeContent: string,
  lockPosts: boolean,
  muteUser: boolean,
  verb: 'banned' | 'shadowbanned' = 'banned'
): string {
  const suffixes: Record<string, string> = {
    'last 24 hours': ' and their content removed for the past 24 hours.',
    'previous 3 days': ' and their content removed for the past 3 days.',
    'previous 7 days': ' and their content removed for the past 7 days.',
    'all time': ' and all their content removed.',
    'Do not remove': ' and their content kept.',
  };
  const lockSuffix = lockPosts ? ' Their posts have been locked.' : '';
  const muteSuffix = muteUser ? ' They have been muted from modmail.' : '';
  return `${username} has been ${verb}${suffixes[removeContent] ?? '.'}${lockSuffix}${muteSuffix}`;
}
