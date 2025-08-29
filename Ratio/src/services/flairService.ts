// src/services/flairService.ts
import { Devvit, TriggerContext } from '@devvit/public-api';
import { AppSettings } from '../types/AppSettings.js';
import { RatioService } from './ratioService.js';
import { FlairUtils } from '../utils/flairUtils.js';
import { ExemptUserUtils } from '../utils/exemptUserUtils.js';
import { WikiService } from './wikiService.js';
import { redisService } from '../services/redisService.js';

export class FlairService {
  static async updateFlairAndRatio(
    context: Devvit.Context,
    userId: string,
    currentPostFlair: string,
    selectedPostFlair: string,
    postId: string
  ): Promise<void> {
    try {
      const settings = await context.settings.getAll() as AppSettings;
      const user = await context.reddit.getUserById(userId);
      const username = user?.username || "unknown";

      console.log(`Updating flair for user ${username} from "${currentPostFlair}" to "${selectedPostFlair}"`);

      // Check if user is exempt
      const exemptUsers = ExemptUserUtils.getExemptUsers(settings);
      const isExempt = ExemptUserUtils.isExemptUser(username, exemptUsers);

      // Update the post's flair regardless of exempt status
      try {
        await FlairUtils.updatePostFlair(context, postId, selectedPostFlair);
        console.log(`Post flair updated successfully`);
      } catch (flairError) {
        console.error(`Failed to update post flair: ${flairError}`);
        context.ui.showToast(`Failed to update post flair: ${flairError instanceof Error ? flairError.message : 'Unknown error'}`);
        return; // Exit if flair update fails
      }

      if (isExempt) {
        console.log(`User ${username} is exempt from ratio rules`);
        context.ui.showToast(`Post flair ${selectedPostFlair === '' ? 'removed' : 'modified'} for exempt user, please refresh.`);
        return;
      }

      const [regularPosts, monitoredPosts] = await RatioService.getUserRatio(userId, context);
      let newRegularPosts = regularPosts;
      let newMonitoredPosts = monitoredPosts;

      console.log(`Current ratio: ${regularPosts}/${monitoredPosts}`);

      const monitoredFlairs = FlairUtils.getMonitoredFlairs(settings);
      console.log(`Monitored flairs: ${monitoredFlairs.join(', ')}`);

      const wasMonitored = FlairUtils.isMonitoredFlair(currentPostFlair, monitoredFlairs);
      const isNowMonitored = FlairUtils.isMonitoredFlair(selectedPostFlair, monitoredFlairs);

      console.log(`Was monitored: ${wasMonitored}, Is now monitored: ${isNowMonitored}`);

      // Update counts based on flair change
      if (!wasMonitored && isNowMonitored) {
        // Post changed from regular to monitored
        newRegularPosts = Math.max(0, regularPosts - 1);
        newMonitoredPosts = monitoredPosts + 1;
        console.log(`Converting regular to monitored post`);
      } else if (wasMonitored && !isNowMonitored) {
        // Post changed from monitored to regular
        newRegularPosts = regularPosts + 1;
        newMonitoredPosts = Math.max(0, monitoredPosts - 1);
        console.log(`Converting monitored to regular post`);

        // Add wrong flair comment if configured
        if (settings.wrongFlairComment !== '') {
          try {
            const commentResponse = await context.reddit.submitComment({
              id: postId,
              text: settings.wrongFlairComment
            });
            commentResponse.distinguish(true);
          } catch (commentError) {
            console.error(`Failed to post wrong flair comment: ${commentError}`);
          }
        }
      } else {
        // No change in monitored status (both monitored or both regular)
        console.log(`No change in post type classification`);
      }

      console.log(`New ratio: ${newRegularPosts}/${newMonitoredPosts}`);
      
      // Check if the post violates ratio rules with the new flair
      const violatesRatio = RatioService.checkRatioViolation(
        newRegularPosts,
        newMonitoredPosts,
        settings.ratioValue,
        settings.invertedRatio || false
      );
      
      if (violatesRatio) {
        console.log(`New ratio would violate rules, removing post`);
        await redisService.markPostAsAppRemoved(postId, context);

        // Remove the post for violation
        await RatioService.removePostForViolation(
          postId,
          settings.ratioViolationComment,
          context
        );
        context.ui.showToast(`Post flair modified but post was removed due to ratio violation.`);
        
        // Record in wiki for transparency
        await WikiService.recordPost(context, {
          authorName: username,
          date: new Date().toISOString().split('T')[0],
          postTitle: `[FLAIR CHANGE - VIOLATION] Post ID: ${postId}`,
          postLink: `https://www.reddit.com/r/${(await context.reddit.getCurrentSubreddit()).name}`,
          ratio: "VIOLATION - NO RATIO CHANGE"
        });
      } else {
        // Only update the user's ratio if the post wasn't removed
        try {
          await RatioService.updateUserRatio(newRegularPosts, newMonitoredPosts, userId, context);
          console.log(`User ratio updated successfully`);
          context.ui.showToast(`Post flair ${selectedPostFlair === '' ? 'removed' : 'modified'}, please refresh.`);
          
          // Record in wiki for tracking
          const newRatio = `${newRegularPosts}/${newMonitoredPosts}`;
          await WikiService.recordPost(context, {
            authorName: username,
            date: new Date().toISOString().split('T')[0],
            postTitle: `[FLAIR CHANGE] From "${currentPostFlair}" to "${selectedPostFlair}"`,
            postLink: `https://www.reddit.com/r/${(await context.reddit.getCurrentSubreddit()).name}`,
            ratio: newRatio
          });
        } catch (ratioError) {
          console.error(`Failed to update user ratio: ${ratioError}`);
          context.ui.showToast(`Post flair updated but failed to update ratio: ${ratioError instanceof Error ? ratioError.message : 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error(`Error in updateFlairAndRatio: ${error}`);
      if (error instanceof Error && error.message) {
        context.ui.showToast(`An error occurred: ${error.message}`);
      } else {
        context.ui.showToast('An unknown error occurred while updating the flair.');
      }
    }
  }
}