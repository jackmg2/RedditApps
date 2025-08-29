import { Devvit, FlairTemplate } from '@devvit/public-api';

export class FlairService {
  static async getFlairTemplates(
    context: Devvit.Context,
    subRedditName: string
  ): Promise<{ label: string; value: string }[]> {
    const templates = await context.reddit.getUserFlairTemplates(subRedditName);
    return templates.map((flair: FlairTemplate) => ({
      label: flair.text,
      value: flair.id
    }));
  }

  static async setUserFlair(
    context: Devvit.Context,
    subRedditName: string,
    username: string,
    flairTemplateId: string
  ): Promise<void> {
    await context.reddit.setUserFlair({
      subredditName: subRedditName,
      username: username,
      flairTemplateId: flairTemplateId
    });
  }
}