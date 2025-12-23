import { MenuItem } from '@devvit/public-api';
import { StorageService } from '../services/storageService.js';
import { modalTimeRangeSelection } from '../forms/timeRangeSelectionForm.js';

export const exportApprovedUsersMenuItem: MenuItem = {
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'Approve & Flair: Export Approved Users',
  onPress: async (event, context) => {
    try {
      const subRedditName = (await context.reddit.getCurrentSubreddit()).name;

      // Get last export date
      const lastExportDate = await StorageService.getLastExportDate(
        context,
        subRedditName
      );

      let lastExportFormatted: string | undefined = undefined;
      if (lastExportDate) {
        lastExportFormatted = lastExportDate.toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }

      const formData: any = {
        subRedditName: subRedditName
      };

      // Only include lastExportDate if it exists
      if (lastExportFormatted) {
        formData.lastExportDate = lastExportFormatted;
      }

      // Show time range selection form
      context.ui.showForm(modalTimeRangeSelection, formData);

    } catch (error) {
      if (error instanceof Error) {
        context.ui.showToast(`Error: ${error.message}`);
      } else {
        context.ui.showToast('Error loading export form');
      }
    }
  }
};