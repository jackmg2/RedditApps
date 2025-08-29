import { MenuItem } from '@devvit/public-api';
import { AppSettings } from '../types/AppSettings.js';
import { FlairService } from '../services/flairService.js';
import { modalBulkApprove } from '../forms/bulkApproveForm.js';

export const bulkApproveMenuItem: MenuItem = {
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'Approve & Flair: Bulk Approve & Flair Users',
  onPress: async (event, context) => {
    try {
      const subRedditName = (await context.reddit.getCurrentSubreddit()).name;
      const flairTemplates = await FlairService.getFlairTemplates(context, subRedditName);
      
      if (flairTemplates.length === 0) {
        context.ui.showToast('No flair templates available in this subreddit');
        return;
      }

      const defaultFlair = [flairTemplates[0].value];
      const settings = await context.settings.getAll() as AppSettings;

      context.ui.showForm(modalBulkApprove, {
        subRedditName: subRedditName,
        flairTemplates: flairTemplates,
        defaultFlair: defaultFlair,
        defaultValueApproveUser: settings.defaultValueApproveUser
      });
    } catch (error) {
      if (error instanceof Error) {
        context.ui.showToast(`Error loading bulk approve form: ${error.message}`);
      } else {
        context.ui.showToast('Error loading bulk approve form');
      }
    }
  }
};