import { AppSettings } from '../types/AppSettings.js';
import { Devvit } from '@devvit/public-api';

export class FlairUtils {
  static getMonitoredFlairs(settings: AppSettings): string[] {
    return settings.monitoredFlair
      .split(';')
      .map(flair => flair.trim())
      .filter(flair => flair.length > 0);
  }

  static isMonitoredFlair(flairText: string | undefined, monitoredFlairs: string[]): boolean {
    return flairText !== undefined && monitoredFlairs.includes(flairText);
  }

  static async updatePostFlair(
    context: Devvit.Context,
    postId: string,
    newFlair: string
  ): Promise<void> {
    try {
      const subReddit = await context.reddit.getCurrentSubreddit();
      const subRedditName = subReddit.name;

      if (newFlair === '') {
        await context.reddit.removePostFlair(subRedditName, postId);
        console.log(`Removed flair from post ${postId}`);
      } else {
        const flairTemplates = await context.reddit.getPostFlairTemplates(subRedditName);
        const correspondingFlairTemplate = flairTemplates.find(f => f.text === newFlair);

        if (!correspondingFlairTemplate) {
          // If no template found, create a basic flair without template
          await context.reddit.setPostFlair({
            subredditName: subRedditName,
            postId: postId,
            text: newFlair,
          });
          console.log(`Set custom flair "${newFlair}" on post ${postId} (no template found)`);
        } else {
          // Use the found template
          await context.reddit.setPostFlair({
            subredditName: subRedditName,
            postId: postId,
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
      throw new Error(`Failed to update post flair: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}