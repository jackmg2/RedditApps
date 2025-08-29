import { MenuItem } from '@devvit/public-api';
import { UserService } from '../services/userService.js';
import { modalExportApprovedUsers } from '../forms/exportUsersForm.js';

export const exportApprovedUsersMenuItem: MenuItem = {
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'Approve & Flair: Export Approved Users',
  onPress: async (event, context) => {
    try {
      const subRedditName = (await context.reddit.getCurrentSubreddit()).name;
      context.ui.showToast('Fetching approved users...');
      
      const approvedUsers = await UserService.getApprovedUsers(context, subRedditName);

      if (approvedUsers.length === 0) {
        context.ui.showToast('No approved users found in this subreddit');
        return;
      }

      const userList = UserService.formatUsersForExport(approvedUsers);

      context.ui.showForm(modalExportApprovedUsers, {
        userList: userList,
        total: approvedUsers.length
      });

    } catch (error) {
      if (error instanceof Error) {
        context.ui.showToast(`Error fetching approved users: ${error.message}`);
      } else {
        context.ui.showToast('Error fetching approved users');
      }
    }
  }
};