import { reddit } from '@devvit/web/server';
import type { User } from '@devvit/reddit';

export async function approveUser(username: string, subredditName: string): Promise<void> {
  await reddit.approveUser(username, subredditName);
}

export async function getContributorsInTimeRange(
  subredditName: string,
  startDate: Date
): Promise<Set<string>> {
  const usernames = new Set<string>();
  const log = reddit.getModerationLog({
    subredditName,
    type: 'addcontributor',
    pageSize: 100,
  });
  for await (const action of log) {
    if (action.createdAt < startDate) break;
    if (action.target?.author) {
      usernames.add(action.target.author.toLowerCase());
    }
  }
  return usernames;
}

export async function getApprovedUsers(subredditName: string): Promise<User[]> {
  return await reddit.getApprovedUsers({ subredditName }).all();
}

export function formatUsersForExport(users: User[]): string {
  return users.map((u) => u.username).join(';');
}

export function parseUsernameList(input: string): string[] {
  return input
    .split(';')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}
