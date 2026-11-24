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

export function getDefaultFlair(options: FlairOption[], templateId?: string): string[] {
  const id = templateId?.trim();
  const selected = options.find((option) => option.value === id) ?? options[0];
  return selected ? [selected.value] : [];
}

export async function setUserFlair(
  subredditName: string,
  username: string,
  flairTemplateId: string
): Promise<void> {
  await reddit.setUserFlair({ subredditName, username, flairTemplateId });
}
