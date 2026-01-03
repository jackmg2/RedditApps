import { Devvit, User } from '@devvit/public-api';

export class UserService {
  /**
   * Get all banned users from a subreddit
   */
  static async getBannedUsers(
    context: Devvit.Context,
    subredditName: string
  ): Promise<User[]> {
    const bannedUsersListing = await context.reddit.getBannedUsers({ 
      subredditName 
    });
    return await bannedUsersListing.all();
  }

  /**
   * Format users for export (semicolon-separated)
   */
  static formatUsersForExport(users: User[]): string {
    return users.map((user: User) => user.username).join(';');
  }

  /**
   * Parse semicolon-separated username list
   */
  static parseUsernameList(usernames: string): string[] {
    return usernames
      .split(';')
      .map(name => name.trim())
      .filter(name => name.length > 0);
  }
}