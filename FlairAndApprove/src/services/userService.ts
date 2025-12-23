import { Devvit, User } from '@devvit/public-api';

export class UserService {
  static async approveUser(
    context: Devvit.Context,
    username: string,
    subRedditName: string
  ): Promise<void> {
    await context.reddit.approveUser(username, subRedditName);
  }

  static async getApprovedUsers(
    context: Devvit.Context,
    subRedditName: string
  ): Promise<User[]> {
    const approvedUsersListing = await context.reddit.getApprovedUsers({ 
      subredditName: subRedditName 
    });
    return await approvedUsersListing.all();
  }

  static formatUsersForExport(users: User[]): string {
    return users.map((user: User) => user.username).join(';');
  }

  static parseUsernameList(usernames: string): string[] {
    return usernames
      .split(';')
      .map(name => name.trim())
      .filter(name => name.length > 0);
  }
}