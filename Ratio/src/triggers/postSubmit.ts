import { TriggerContext } from '@devvit/public-api';
import { AppSettings } from '../types/AppSettings.js';
import { RatioService } from '../services/ratioService.js';
import { WikiService } from '../services/wikiService.js';
import { FlairUtils } from '../utils/flairUtils.js';

export const postSubmitTrigger = {
  event: 'PostSubmit' as const,
  onEvent: async(event: any, context: TriggerContext) => {
    const settings = await context.settings.getAll() as AppSettings;
    const post = event.post;
    
    if (post != null) {
      const userId = post.authorId;
      const user = await context.reddit.getUserById(userId);
      const username = user?.username || "unknown";

      // Get current post counts
      const [regularPosts, monitoredPosts] = await RatioService.getUserRatio(userId, context);

      // Check if this post has the monitored flair
      const monitoredFlairs = FlairUtils.getMonitoredFlairs(settings);
      const isMonitoredFlair = FlairUtils.isMonitoredFlair(post.linkFlair?.text, monitoredFlairs);

      // Calculate potential new counts
      const newRegularPosts = isMonitoredFlair ? regularPosts : regularPosts + 1;
      const newMonitoredPosts = isMonitoredFlair ? monitoredPosts + 1 : monitoredPosts;

      // Check if the new ratio would violate the rules
      const wouldViolateRatio = RatioService.checkRatioViolation(
        newRegularPosts, 
        newMonitoredPosts, 
        settings.ratioValue
      );

      if (wouldViolateRatio) {
        await RatioService.removePostForViolation(
          post.id, 
          settings.ratioViolationComment, 
          context
        );
        return;
      }

      // Update the ratio and record the post
      try {
        await RatioService.updateUserRatio(newRegularPosts, newMonitoredPosts, userId, context);

        // Record post for wiki tracking
        const newRatio = `${newRegularPosts}/${newMonitoredPosts}`;
        await WikiService.recordPost(context, {
          authorName: username,
          date: new Date().toISOString().split('T')[0],
          postTitle: post.title || "Untitled",
          postLink: `https://www.reddit.com${post.permalink}`,
          ratio: newRatio
        });
      } catch (error) {
        console.error('Error updating user flair:', error);
      }
    }
  }
};