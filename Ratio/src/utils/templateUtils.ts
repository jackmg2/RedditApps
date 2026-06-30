import type { AppSettings } from '../types/AppSettings';

/**
 * Replaces `{{token}}` placeholders with the given values. Unknown tokens are
 * left intact so typos stay visible to moderators instead of vanishing.
 */
export function renderTemplate(
  template: string,
  vars: Record<string, string | number>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, token: string) =>
    token in vars ? String(vars[token]) : match
  );
}

/**
 * Standard placeholder set for the configurable comments. `remaining` is the
 * number of posts of the restricted class the user can still make: regular
 * posts in normal mode, monitored posts in inverted mode.
 */
export function buildRatioVars(
  username: string,
  regular: number,
  monitored: number,
  settings: AppSettings
): Record<string, string | number> {
  const remaining = settings.invertedRatio
    ? Math.floor(regular / settings.ratioValue) +
      settings.startingCredit -
      monitored
    : settings.ratioValue * (monitored + settings.startingCredit) - regular;

  return {
    username,
    regular,
    monitored,
    ratio: settings.ratioValue,
    balance: `${regular}/${monitored}`,
    remaining: Math.max(0, remaining),
  };
}
