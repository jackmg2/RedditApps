import { redis } from '@devvit/web/server';

const APPROVAL_ZSET_PREFIX = 'approval_timestamps';
const LAST_EXPORT_PREFIX = 'last_export_date';

function approvalKey(subredditName: string): string {
  return `${APPROVAL_ZSET_PREFIX}_${subredditName}`;
}

function exportKey(subredditName: string): string {
  return `${LAST_EXPORT_PREFIX}_${subredditName}`;
}

export async function storeApprovalTimestamp(
  username: string,
  subredditName: string
): Promise<void> {
  try {
    await redis.zAdd(approvalKey(subredditName), { member: username, score: Date.now() });
  } catch (error) {
    console.error(`Failed to store approval timestamp for ${username}:`, error);
  }
}

export async function getUsersInTimeRange(
  subredditName: string,
  startTime: number,
  endTime: number
): Promise<string[]> {
  try {
    const results = await redis.zRange(approvalKey(subredditName), startTime, endTime, {
      by: 'score',
    });
    return results.map((r) => r.member);
  } catch (error) {
    console.error('Failed to get users in time range:', error);
    return [];
  }
}

export async function getFilteredUsernames(
  subredditName: string,
  timeRange: 'all' | 'month' | 'week'
): Promise<Set<string>> {
  if (timeRange === 'all') {
    return new Set<string>();
  }

  const now = Date.now();
  const startTime =
    timeRange === 'month'
      ? now - 30 * 24 * 60 * 60 * 1000
      : now - 7 * 24 * 60 * 60 * 1000;

  const usernames = await getUsersInTimeRange(subredditName, startTime, now);
  return new Set(usernames);
}

export async function storeLastExportDate(subredditName: string): Promise<void> {
  try {
    await redis.set(exportKey(subredditName), new Date().toISOString());
  } catch (error) {
    console.error('Failed to store last export date:', error);
  }
}

export async function getLastExportDate(subredditName: string): Promise<Date | null> {
  try {
    const value = await redis.get(exportKey(subredditName));
    return value ? new Date(value) : null;
  } catch (error) {
    console.error('Failed to get last export date:', error);
    return null;
  }
}
