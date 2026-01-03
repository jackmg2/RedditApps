import { MenuItem } from '@devvit/public-api';
import { AppSettings } from '../types/appSettings.js';
import { modalBulkBan } from '../forms/bulkBanForm.js';

export const bulkBanUsersMenuItem: MenuItem = {
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'Ban Extended: Bulk Ban Users',
  onPress: async (event, context) => {
    try {
      const subRedditName = (await context.reddit.getCurrentSubreddit()).name;
      const subredditRules = await context.reddit.getSubredditRemovalReasons(subRedditName);
      
      if (subredditRules.length === 0) {
        context.ui.showToast('No removal reasons available in this subreddit');
        return;
      }

      // Get settings values
      const settings = await context.settings.getAll() as AppSettings;
      const defaultBanDuration = settings.defaultBanDuration || 'permanent';
      const defaultRemoveContent = settings.defaultRemoveContent || 'Do not remove';

      context.ui.showForm(modalBulkBan, {
        subRedditName: subRedditName,
        subredditRules: subredditRules.map(rule => ({ 
          label: rule.title, 
          value: rule.message 
        })),
        defaultBanDuration: defaultBanDuration,
        defaultRemoveContent: defaultRemoveContent
      });
    } catch (error) {
      if (error instanceof Error) {
        context.ui.showToast(`Error loading bulk ban form: ${error.message}`);
      } else {
        context.ui.showToast('Error loading bulk ban form');
      }
    }
  }
};