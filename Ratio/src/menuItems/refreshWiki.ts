import { MenuItem } from '@devvit/public-api';
import { redisService } from '../services/redisService.js';
import { WikiService } from '../services/wikiService.js';

export const refreshWikiMenuItem: MenuItem = {
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'Ratio: Refresh Wiki',
  onPress: async (event, context) => {
    try {
      // Get posts from Redis
      const posts = await redisService.getPostRecords(context);

      if (posts.length === 0) {
        context.ui.showToast('No post records found to update wiki.');
        return;
      }

      // Update wiki
      await WikiService.updateWikiPage(context, posts);
      context.ui.showToast('RedditRatio wiki page updated successfully.');
    } catch (error) {
      if (error instanceof Error) {
        context.ui.showToast(`Error updating wiki: ${error.message}`);
      } else {
        context.ui.showToast('An unknown error occurred while updating the wiki.');
      }
    }
  }
};