// src/services/flairService.ts
import { Devvit, TriggerContext } from '@devvit/public-api';
import { AppSettings } from '../types/AppSettings.js';
import { RatioService } from './ratioService.js';
import { FlairUtils } from '../utils/flairUtils.js';
import { ExemptUserUtils } from '../utils/exemptUserUtils.js';
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

      // Check if user is exempt
      const exemptUsers = ExemptUserUtils.getExemptUsers(settings);
      const isExempt = ExemptUserUtils.isExemptUser(username, exemptUsers);

      // Update the post's flair regardless of exempt status
      await FlairUtils.updatePostFlair(context, postId, selectedPostFlair);

      if (isExempt) {
        console.log(`User ${username} is exempt from ratio rules`);
        context.ui.showToast(`Post flair ${selectedPostFlair === '' ? 'removed' : 'modified'} for exempt user, please refresh.`);
        return;
      }

      const [regularPosts, monitoredPosts] = await RatioService.getUserRatio(userId, context);
      let newRegularPosts = regularPosts;
      let newMonitoredPosts = monitoredPosts;

      const monitoredFlairs = FlairUtils.getMonitoredFlairs(settings);

      const wasMonitored = monitoredFlairs.some(f => f === currentPostFlair);
      const isNowMonitored = monitoredFlairs.some(f => f === selectedPostFlair);

      // Update counts based on flair change
      if (!wasMonitored && isNowMonitored) {
        newRegularPosts--;
        newMonitoredPosts++;
      } else if (wasMonitored && !isNowMonitored) {
        newRegularPosts++;
        newMonitoredPosts--;

        // Add wrong flair comment if configured
        if (settings.wrongFlairComment !== '') {
          const commentResponse = await context.reddit.submitComment({
            id: postId,
            text: settings.wrongFlairComment
          });
          commentResponse.distinguish(true);
        }
      }
      
      // Check if the post violates ratio rules with the new flair
      const violatesRatio = RatioService.checkRatioViolation(
        newRegularPosts,
        newMonitoredPosts,
        settings.ratioValue,
        settings.invertedRatio || false
      );
      
      if (violatesRatio) {
                await redisService.markPostAsAppRemoved(postId, context);

        // Remove the post for violation
        await RatioService.removePostForViolation(
          postId,
          settings.ratioViolationComment,
          context
        );
        context.ui.showToast(`Post flair modified but post was removed due to ratio violation.`);
      } else {
        // Only update the user's ratio if the post wasn't removed
        await RatioService.updateUserRatio(newRegularPosts, newMonitoredPosts, userId, context);
        context.ui.showToast(`Post flair ${selectedPostFlair === '' ? 'removed' : 'modified'}, please refresh.`);
      }
    } catch (error) {
      if (error instanceof Error && error.message) {
        context.ui.showToast(`An error occurred: ${error.message}`);
      } else {
        context.ui.showToast('An unknown error occurred while updating the flair.');
      }
    }
  }
}