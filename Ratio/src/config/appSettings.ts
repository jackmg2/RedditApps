import { settings } from '@devvit/web/server';
import type { AppSettings } from '../types/AppSettings';

// Defaults mirror the setting defaults declared in devvit.json; settings may
// be undefined until a moderator saves the settings page at least once.
const defaults: AppSettings = {
  invertedRatio: false,
  ratioValue: 3,
  startingCredit: 1,
  monitoredFlair: 'Your post flair;Your second post flair',
  exemptUsers: '',
  decreaseMonitoredOnRemoval: true,
  decreaseRegularOnRemoval: true,
  ratioViolationComment:
    'Your post has been removed due to exceeding the allowed post ratio.',
  wrongFlairComment: '',
  creditEarnedComment: '',
  postCreditEarnedComment: true,
};

export async function getAppSettings(): Promise<AppSettings> {
  const all = await settings.getAll<Partial<AppSettings>>();
  const rawCredit = Number(all.startingCredit ?? defaults.startingCredit);
  return {
    invertedRatio: all.invertedRatio ?? defaults.invertedRatio,
    ratioValue: all.ratioValue ?? defaults.ratioValue,
    startingCredit: Number.isFinite(rawCredit)
      ? Math.max(0, Math.floor(rawCredit))
      : defaults.startingCredit,
    monitoredFlair: all.monitoredFlair ?? defaults.monitoredFlair,
    exemptUsers: all.exemptUsers ?? defaults.exemptUsers,
    decreaseMonitoredOnRemoval:
      all.decreaseMonitoredOnRemoval ?? defaults.decreaseMonitoredOnRemoval,
    decreaseRegularOnRemoval:
      all.decreaseRegularOnRemoval ?? defaults.decreaseRegularOnRemoval,
    ratioViolationComment:
      all.ratioViolationComment ?? defaults.ratioViolationComment,
    wrongFlairComment: all.wrongFlairComment ?? defaults.wrongFlairComment,
    creditEarnedComment:
      all.creditEarnedComment ?? defaults.creditEarnedComment,
    postCreditEarnedComment:
      all.postCreditEarnedComment ?? defaults.postCreditEarnedComment,
  };
}
