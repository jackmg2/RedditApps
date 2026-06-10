import { reddit } from '@devvit/web/server';
import type { T1, T3 } from '@devvit/shared-types/tid.js';

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
  ruleViolated: string;
  banMessage: string;
  removeContent: string;
  markAsSpam: boolean;
};

export type BulkBanInput = {
  subredditName: string;
  usernames: string;
  banDuration: number | undefined;
  ruleViolated: string;
  banMessage: string;
  removeContent: string;
  markAsSpam: boolean;
};

export type BulkBanResult = {
  successCount: number;
  errorCount: number;
  errors: string[];
};

export async function banUser(input: BanInput): Promise<void> {
  await reddit.banUser({
    subredditName: input.subredditName,
    username: input.username,
    reason: `${input.ruleViolated}`.substring(0, 100),
    message: input.banMessage,
    ...(input.banDuration !== undefined ? { duration: input.banDuration } : {}),
  });
}

export async function removeUserContent(
  username: string,
  subredditName: string,
  markAsSpam: boolean,
  timePeriod: string
): Promise<void> {
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

  await Promise.all([
    ...postsToRemove.map((item) => reddit.remove(item.id as T3, markAsSpam)),
    ...commentsToRemove.map((item) => reddit.remove(item.id as T1, markAsSpam)),
  ]);
}

export async function processBan(input: BanInput): Promise<string> {
  let errorDuringBan = false;
  let errorDuringRemoval = false;
  let errorMessage = '';

  try {
    await banUser(input);
  } catch (error) {
    errorMessage = `Error banning ${input.username}: ${error}`;
    console.error(errorMessage);
    errorDuringBan = true;
  }

  if (!errorDuringBan && input.removeContent !== 'Do not remove') {
    try {
      await removeUserContent(input.username, input.subredditName, input.markAsSpam, input.removeContent);
    } catch (error) {
      errorMessage = `Error removing ${input.username}'s content: ${error}`;
      console.error(errorMessage);
      errorDuringRemoval = true;
    }
  }

  if (errorDuringBan || errorDuringRemoval) return errorMessage;
  return buildSuccessMessage(input.username, input.removeContent);
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
        ...(input.banDuration !== undefined ? { duration: input.banDuration } : {}),
      });
    } catch (error) {
      errorDuringBan = true;
      errors.push(`${username} (ban): ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    if (!errorDuringBan && input.removeContent !== 'Do not remove') {
      try {
        await removeUserContent(username, input.subredditName, input.markAsSpam, input.removeContent);
      } catch (error) {
        errors.push(`${username} (removal): ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (!errorDuringBan) successCount++;
  }

  return { successCount, errorCount: errors.length, errors };
}

export function parseUsernameList(input: string): string[] {
  return input
    .split(';')
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

function buildSuccessMessage(username: string, removeContent: string): string {
  const suffixes: Record<string, string> = {
    'last 24 hours': ' and their content removed for the past 24 hours.',
    'previous 3 days': ' and their content removed for the past 3 days.',
    'previous 7 days': ' and their content removed for the past 7 days.',
    'all time': ' and all their content removed.',
    'Do not remove': ' and their content kept.',
  };
  return `${username} has been banned${suffixes[removeContent] ?? '.'}`;
}
