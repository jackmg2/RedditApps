import { reddit } from '@devvit/web/server';

export async function getBannedUsers(subredditName: string) {
  return reddit.getBannedUsers({ subredditName }).all();
}

export function formatUsersForExport(users: { username: string }[]): string {
  return users.map((u) => u.username).join(';');
}
