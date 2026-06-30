import { context, reddit } from '@devvit/web/server';
import { T3 } from '@devvit/shared-types/tid.js';
import type { AppSettings } from '../types/AppSettings';
import { redisService } from '../services/redisService';

export class FlairUtils {
  static getMonitoredFlairs(settings: AppSettings): string[] {
    return settings.monitoredFlair
      .split(';')
      .map((flair) => flair.trim())
      .filter((flair) => flair.length > 0);
  }

  static isMonitoredFlair(
    flairText: string | undefined,
    monitoredFlairs: string[]
  ): boolean {
    return flairText !== undefined && monitoredFlairs.includes(flairText);
  }

  static async updatePostFlair(
    postId: string,
    newFlair: string
  ): Promise<void> {
    try {
      const subRedditName = context.subredditName;

      // Flag this write so the PostFlairUpdate trigger it causes is ignored
      // (the caller updates the counts itself).
      await redisService.markAppFlairSet(postId);

      if (newFlair === '') {
        await reddit.removePostFlair(subRedditName, T3(postId));
        console.log(`Removed flair from post ${postId}`);
      } else {
        const flairTemplates =
          await reddit.getPostFlairTemplates(subRedditName);
        const correspondingFlairTemplate = flairTemplates.find(
          (f) => f.text === newFlair
        );

        if (!correspondingFlairTemplate) {
          // If no template found, create a basic flair without template
          await reddit.setPostFlair({
            subredditName: subRedditName,
            postId: T3(postId),
            text: newFlair,
          });
          console.log(
            `Set custom flair "${newFlair}" on post ${postId} (no template found)`
          );
        } else {
          // Use the found template
          await reddit.setPostFlair({
            subredditName: subRedditName,
            postId: T3(postId),
            flairTemplateId: correspondingFlairTemplate.id,
            text: correspondingFlairTemplate.text,
            backgroundColor: correspondingFlairTemplate.backgroundColor,
            textColor: correspondingFlairTemplate.textColor,
          });
          console.log(`Set templated flair "${newFlair}" on post ${postId}`);
        }
      }
    } catch (error) {
      console.error(`Error updating post flair: ${error}`);
      throw new Error(
        `Failed to update post flair: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { cause: error }
      );
    }
  }
}
