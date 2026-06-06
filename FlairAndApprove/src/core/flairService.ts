import { reddit } from '@devvit/web/server';

export type FlairOption = {
  label: string;
  value: string;
};

export async function getFlairTemplates(subredditName: string): Promise<FlairOption[]> {
  const templates = await reddit.getUserFlairTemplates(subredditName);
  return templates.map((flair) => ({
    label: flair.text,
    value: flair.id,
  }));
}

export async function setUserFlair(
  subredditName: string,
  username: string,
  flairTemplateId: string
): Promise<void> {
  await reddit.setUserFlair({ subredditName, username, flairTemplateId });
}
