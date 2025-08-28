import { TriggerContext } from '@devvit/public-api';
import { AppSettings } from '../types/AppSettings.js';
import { RatioService } from '../services/ratioService.js';
import { WikiService } from '../services/wikiService.js';
import { FlairUtils } from '../utils/flairUtils.js';
import { ExemptUserUtils } from '../utils/exemptUserUtils.js';

export const postDeleteTrigger = {
  event: 'PostDelete' as const,
  onEvent: async(event: any, context: TriggerContext) => {
    const post = event.postId ? await context.reddit.getPostById(event.postId) : null;
    
    if (post != null) {
      console.log('Post deleted:', post.id);
      console.log('Post author:', event.author?.id);
      
      const userId = event.author?.id as string;
      const user = await context.reddit.getUserById(userId);
      
      if (!user) {
        console.error('Could not find user for deleted post');
        return;
      }

      const settings = await context.settings.getAll() as AppSettings;
      const username = user.username || "unknown";

      // Check if user is exempt
      const exemptUsers = ExemptUserUtils.getExemptUsers(settings);
      const isExempt = ExemptUserUtils.isExemptUser(username, exemptUsers);

      if (isExempt) {
        console.log(`User ${username} is exempt from ratio rules`);
        // Still record the deletion for wiki tracking
        await WikiService.recordPost(context, {
          authorName: username,
          date: new Date().toISOString().split('T')[0],
          postTitle: post.title ? `[DELETED] ${post.title}` : "[DELETED POST]",
          postLink: `https://www.reddit.com${post.permalink}`,
          ratio: "EXEMPT"
        });
        return;
      }

      // Get current ratio
      const [regularPosts, monitoredPosts] = await RatioService.getUserRatio(userId, context);

      // Check if this post had a monitored flair
      const monitoredFlairs = FlairUtils.getMonitoredFlairs(settings);
      const wasMonitoredFlair = FlairUtils.isMonitoredFlair(post.flair?.text, monitoredFlairs);

      // Update counts based on the deleted post's flair
      const newRegularPosts = wasMonitoredFlair ? regularPosts : Math.max(0, regularPosts - 1);
      const newMonitoredPosts = wasMonitoredFlair ? Math.max(0, monitoredPosts - 1) : monitoredPosts;

      // Update the user's ratio
      try {
        await RatioService.updateUserRatio(newRegularPosts, newMonitoredPosts, userId, context);
        
        // Add a record to the wiki about the post deletion
        const newRatio = `${newRegularPosts}/${newMonitoredPosts}`;
        await WikiService.recordPost(context, {
          authorName: username,
          date: new Date().toISOString().split('T')[0],
          postTitle: post.title ? `[DELETED] ${post.title}` : "[DELETED POST]",
          postLink: `https://www.reddit.com${post.permalink}`,
          ratio: newRatio
        });
      } catch (error) {
        console.error('Error updating user flair after post deletion:', error);
      }
    }
  }
};