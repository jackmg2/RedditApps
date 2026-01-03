import { MenuItem } from '@devvit/public-api';
import { UserService } from '../services/userService.js';
import { modalExportBannedUsers } from '../forms/exportBannedUsersForm.js';

export const exportBannedUsersMenuItem: MenuItem = {
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'Ban Extended: Export Banned Users',
  onPress: async (event, context) => {
    try {
      const subRedditName = (await context.reddit.getCurrentSubreddit()).name;
      context.ui.showToast('Fetching banned users...');
      
      const bannedUsersArray = await UserService.getBannedUsers(context, subRedditName);

      if (bannedUsersArray.length === 0) {
        context.ui.showToast('No banned users found in this subreddit');
        return;
      }

      const userList = UserService.formatUsersForExport(bannedUsersArray);

      context.ui.showForm(modalExportBannedUsers, {
        userList: userList,
        total: bannedUsersArray.length
      });

    } catch (error) {
      if (error instanceof Error) {
        context.ui.showToast(`Error fetching banned users: ${error.message}`);
      } else {
        context.ui.showToast('Error fetching banned users');
      }
    }
  }
};