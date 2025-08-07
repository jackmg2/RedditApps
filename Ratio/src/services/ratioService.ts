import { TriggerContext, Devvit } from '@devvit/public-api';
import { AppSettings } from '../types/AppSettings.js';
import { redisService } from './redisService.js';

export class RatioService {
  static async getUserRatio(userId: string, context: TriggerContext | Devvit.Context): Promise<[number, number]> {
    const ratio = await redisService.getUserRatio(userId, context);
    return ratio.split('/').map(Number) as [number, number];
  }

  static async updateUserRatio(
    regularPosts: number, 
    monitoredPosts: number, 
    userId: string,
    context: TriggerContext | Devvit.Context
  ): Promise<void> {
    const ratio = `[${regularPosts}/${monitoredPosts}]`;
    const subReddit = await context.reddit.getCurrentSubreddit();
    const subRedditName = subReddit.name;
    const user = await context.reddit.getUserById(userId);
    const username = user?.username as string;
    const currentUserFlair = await subReddit.getUserFlair({ usernames: [username] });

    if (currentUserFlair && currentUserFlair.users.length > 0) {
      let newFlairText = currentUserFlair?.users[0].flairText || '';
      
      // Remove old ratio if it exists
      newFlairText = newFlairText.replace(/\[\d+\/\d+\]$/, '').trim();
      
      // Add new ratio
      newFlairText = `${newFlairText} ${ratio}`.trim();
      
      try {
        await context.reddit.setUserFlair({
          subredditName: subRedditName,
          username: username,
          cssClass: currentUserFlair?.users[0].flairCssClass || '',
          text: newFlairText
        });

        // Update counts in Redis
        await redisService.setUserRatio(userId, regularPosts, monitoredPosts, context);
      } catch (error) {
        console.log(`Error: ${error}`);
      }
      
      console.log(`New flair ${newFlairText} for ${username} in ${subRedditName}`);
    }
  }

  static checkRatioViolation(
    regularPosts: number, 
    monitoredPosts: number, 
    ratioValue: number
  ): boolean {
    return regularPosts > ratioValue * monitoredPosts;
  }

  static async removePostForViolation(
    postId: string, 
    violationComment: string,
    context: TriggerContext | Devvit.Context
  ): Promise<void> {
    if (violationComment !== '') {
      const commentResponse = await context.reddit.submitComment({
        id: postId,
        text: violationComment
      });
      commentResponse.distinguish(true);
    }
    
    await context.reddit.remove(postId, false);
  }
}