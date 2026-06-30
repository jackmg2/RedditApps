import { reddit } from '@devvit/web/server';
import { T2, T3 } from '@devvit/shared-types/tid.js';
import type { AppSettings } from '../types/AppSettings';
import { getAppSettings } from '../config/appSettings';
import { redisService } from './redisService';
import { ExemptUserUtils } from '../utils/exemptUserUtils';

export class RatioService {
  static async getUserRatio(userId: string): Promise<[number, number]> {
    const { regular, monitored } = await redisService.getUserCounts(userId);
    return [regular, monitored];
  }

  /**
   * Sets the user's counts to explicit values (manual moderator adjustments)
   * and refreshes the flair display.
   */
  static async updateUserRatio(
    regularPosts: number,
    monitoredPosts: number,
    userId: string
  ): Promise<void> {
    await redisService.setUserCounts(userId, regularPosts, monitoredPosts);
    await this.updateUserFlairDisplay(userId, regularPosts, monitoredPosts);
  }

  /** Appends the `[regular/monitored]` ratio to the user's flair. */
  static async updateUserFlairDisplay(
    userId: string,
    regularPosts: number,
    monitoredPosts: number
  ): Promise<void> {
    const settings = await getAppSettings();
    const user = await reddit.getUserById(T2(userId));
    const username = user?.username as string;

    // Skip flair modification for exempt users
    const exemptUsers = ExemptUserUtils.getExemptUsers(settings);
    if (ExemptUserUtils.isExemptUser(username, exemptUsers)) {
      console.log(`User ${username} is exempt from ratio display`);
      return;
    }

    // Note: Always display as [regular/monitored] regardless of mode
    const ratio = `[${regularPosts}/${monitoredPosts}]`;

    const subReddit = await reddit.getCurrentSubreddit();
    const subRedditName = subReddit.name;
    const currentUserFlair = await subReddit.getUserFlair({
      usernames: [username],
    });

    if (currentUserFlair && currentUserFlair.users.length > 0) {
      let newFlairText = currentUserFlair?.users[0]?.flairText || '';

      // Remove old ratio if it exists
      newFlairText = newFlairText.replace(/\[\d+\/\d+\]$/, '').trim();

      // Add new ratio
      newFlairText = `${newFlairText} ${ratio}`.trim();

      try {
        await reddit.setUserFlair({
          subredditName: subRedditName,
          username: username,
          cssClass: currentUserFlair?.users[0]?.flairCssClass || '',
          text: newFlairText,
        });
      } catch (error) {
        console.log(`Error: ${error}`);
      }

      console.log(
        `New flair ${newFlairText} for ${username} in ${subRedditName}`
      );
    }
  }

  static checkRatioViolation(
    regularPosts: number,
    monitoredPosts: number,
    settings: AppSettings
  ): boolean {
    if (settings.invertedRatio) {
      // Inverted mode: monitored posts limited by earned slots plus credit
      return (
        monitoredPosts >
        Math.floor(regularPosts / settings.ratioValue) + settings.startingCredit
      );
    } else {
      // Normal mode: regular posts limited by monitored posts plus credit
      return (
        regularPosts >
        settings.ratioValue * (monitoredPosts + settings.startingCredit)
      );
    }
  }

  /**
   * Removes a post with an optional distinguished comment. The comment text
   * must already be rendered (placeholders resolved). Callers are responsible
   * for having marked the post's state as app-removed beforehand.
   */
  static async removePostForViolation(
    postId: string,
    violationComment: string
  ): Promise<void> {
    if (violationComment !== '') {
      const commentResponse = await reddit.submitComment({
        id: T3(postId),
        text: violationComment,
      });
      await commentResponse.distinguish(true);
    }

    await reddit.remove(T3(postId), false);
  }
}
