import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import * as banService from '../core/banService.js';

type BanUserValues = {
  subRedditName?: string;
  username?: string;
  banDuration?: string[];
  ruleViolated?: string[];
  banMessage?: string;
  removeContent?: string[];
  markAsSpam?: boolean;
};

type BulkBanValues = {
  subRedditName?: string;
  usernames?: string;
  banDuration?: string[];
  ruleViolated?: string[];
  banMessage?: string;
  removeContent?: string[];
  markAsSpam?: boolean;
};

type ExportBannedUsersValues = {
  subRedditName?: string;
};

export const forms = new Hono();

forms.post('/ban-user-submit', async (c) => {
  const values = await c.req.json<BanUserValues>();

  const rawDuration = values.banDuration?.[0] ?? 'permanent';
  const banDuration = rawDuration === 'permanent' ? undefined : parseInt(rawDuration);

  try {
    const message = await banService.processBan({
      subredditName: values.subRedditName ?? context.subredditName,
      username: values.username ?? '',
      banDuration,
      ruleViolated: values.ruleViolated?.[0] ?? '',
      banMessage: values.banMessage ?? '',
      removeContent: values.removeContent?.[0] ?? 'Do not remove',
      markAsSpam: Boolean(values.markAsSpam),
    });
    return c.json<UiResponse>({ showToast: message }, 200);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return c.json<UiResponse>({ showToast: `Error: ${msg}` }, 200);
  }
});

forms.post('/bulk-ban-submit', async (c) => {
  const values = await c.req.json<BulkBanValues>();

  if (!values.usernames?.trim()) {
    return c.json<UiResponse>({ showToast: 'No valid usernames provided' }, 200);
  }

  const rawDuration = values.banDuration?.[0] ?? 'permanent';
  const banDuration = rawDuration === 'permanent' ? undefined : parseInt(rawDuration);

  try {
    const result = await banService.processBulkBan({
      subredditName: values.subRedditName ?? context.subredditName,
      usernames: values.usernames,
      banDuration,
      ruleViolated: values.ruleViolated?.[0] ?? '',
      banMessage: values.banMessage ?? '',
      removeContent: values.removeContent?.[0] ?? 'Do not remove',
      markAsSpam: Boolean(values.markAsSpam),
    });

    if (result.errorCount === 0) {
      return c.json<UiResponse>({ showToast: `✅ Successfully banned ${result.successCount} users` }, 200);
    }

    const errorSummary = result.errors.slice(0, 3).join('; ');
    const more = result.errors.length > 3 ? '...' : '';
    const toast =
      result.successCount > 0
        ? `✅ Banned ${result.successCount}. ❌ Failed ${result.errorCount}: ${errorSummary}${more}`
        : `❌ Failed to ban ${result.errorCount} users. Errors: ${errorSummary}${more}`;

    return c.json<UiResponse>({ showToast: toast }, 200);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return c.json<UiResponse>({ showToast: `Error: ${msg}` }, 200);
  }
});

forms.post('/export-banned-users-submit', async (c) => {
  return c.json<UiResponse>({ showToast: 'Banned users list exported' }, 200);
});
