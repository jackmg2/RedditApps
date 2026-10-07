import { reddit, settings } from '@devvit/web/server';
import type { AppSettings } from '../types/AppSettings.js';

/**
 * Resolves the texts attached to a ban (or shadowban) from the submitted form
 * values, the subreddit's removal reasons and the app settings.
 *
 * The ban forms store the removal reason *id* in the "Rule Violated" select, so
 * the rule's title and message are looked up here at submit time. Both the ban
 * message and the mod note accept `{rule}` and `{ruleMessage}` placeholders.
 */

export type RuleInfo = {
  /** The removal reason title, e.g. "Rule 3: No spam". Empty when no rule was selected. */
  title: string;
  /** The removal reason text written by the mods for users. Empty when no rule was selected. */
  message: string;
};

export type BanTexts = {
  /** Rule title, used as Reddit's 100-char ban reason. */
  ruleViolated: string;
  /** Message sent to the banned user, placeholders resolved. */
  banMessage: string;
  /** Mod-only note, placeholders resolved. */
  banNote: string;
};

/** Reddit's limit for the mod note attached to a ban. */
export const BAN_NOTE_MAX_LENGTH = 300;

const EMPTY_RULE: RuleInfo = { title: '', message: '' };

export async function resolveRule(subredditName: string, ruleId: string | undefined): Promise<RuleInfo> {
  if (!ruleId) return EMPTY_RULE;
  const reasons = await reddit.getSubredditRemovalReasons(subredditName);
  const match = reasons.find((r) => r.id === ruleId);
  if (!match) {
    console.warn(`Removal reason ${ruleId} not found in r/${subredditName}; ban texts will have no rule.`);
    return EMPTY_RULE;
  }
  return { title: match.title, message: match.message };
}

/**
 * Replaces `{rule}` and `{ruleMessage}` (spaces inside the braces allowed) with the rule's texts.
 * A template that only leaves separators once resolved (e.g. "{rule} - {ruleMessage}" with no
 * rule selected) yields an empty string rather than a stray "-".
 */
export function applyTemplate(template: string, rule: RuleInfo): string {
  const resolved = template
    .replace(/\{\s*ruleMessage\s*\}/g, rule.message)
    .replace(/\{\s*rule\s*\}/g, rule.title)
    .trim();
  return /^[\s\-–—:|,.;/]*$/.test(resolved) ? '' : resolved;
}

/**
 * Picks the template to use for a form field: the submitted value when the field
 * was shown, otherwise the default from the settings. A shown field that was
 * cleared by the moderator stays empty on purpose.
 */
export function pickTemplate(fieldShown: boolean, submitted: string | undefined, defaultTemplate: string | undefined): string {
  if (fieldShown) return submitted ?? '';
  return defaultTemplate ?? '';
}

export async function resolveBanTexts(input: {
  subredditName: string;
  ruleId: string | undefined;
  banMessage: string | undefined;
  banNote: string | undefined;
}): Promise<BanTexts> {
  const [rule, appSettings] = await Promise.all([
    resolveRule(input.subredditName, input.ruleId),
    settings.getAll<AppSettings>(),
  ]);

  const showMessageField = appSettings.showMessageField ?? true;
  const showNoteField = appSettings.showNoteField ?? true;

  const messageTemplate = pickTemplate(showMessageField, input.banMessage, appSettings.defaultBanMessage);
  const noteTemplate = pickTemplate(showNoteField, input.banNote, appSettings.defaultBanNote);

  return {
    ruleViolated: rule.title,
    banMessage: applyTemplate(messageTemplate, rule),
    banNote: applyTemplate(noteTemplate, rule).substring(0, BAN_NOTE_MAX_LENGTH),
  };
}
