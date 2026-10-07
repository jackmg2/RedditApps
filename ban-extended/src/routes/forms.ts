import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context, reddit } from '@devvit/web/server';
import * as banService from '../core/banService.js';
import * as shadowbanService from '../core/shadowbanService.js';
import { resolveBanTexts } from '../core/banTexts.js';
import {
  checkModPermission,
  permissionDeniedResponse,
  type ModPermission,
} from '../toolkit/modPermissions.js';

// Banning users needs 'access'; removing or locking their content additionally needs 'posts'.
// Muting from modmail is also covered by 'access', so it adds no requirement.
function requiredBanPermissions(removeContent: string | undefined, lockPosts: boolean): ModPermission[] {
  const touchesContent = (removeContent !== undefined && removeContent !== 'Do not remove') || lockPosts;
  return touchesContent ? ['access', 'posts'] : ['access'];
}

// ruleViolated carries the removal reason id; banMessage and banNote are absent when the
// subreddit hides those fields, in which case the defaults from the settings apply.
type BanUserValues = {
  subRedditName?: string;
  username?: string;
  banDuration?: string[];
  ruleViolated?: string[];
  banMessage?: string;
  banNote?: string;
  removeContent?: string[];
  lockPosts?: boolean;
  muteUser?: boolean;
  markAsSpam?: boolean;
};

// Unbanning (and unmuting) needs 'access'; re-approving or unlocking content additionally needs 'posts'.
function requiredUnbanPermissions(restoreContent: boolean, unlockPosts: boolean): ModPermission[] {
  return restoreContent || unlockPosts ? ['access', 'posts'] : ['access'];
}

type UndoBanValues = {
  subRedditName?: string;
  username?: string;
  restoreContent?: boolean;
  unlockPosts?: boolean;
  unmuteUser?: boolean;
};

type BulkBanValues = {
  subRedditName?: string;
  usernames?: string;
  banDuration?: string[];
  ruleViolated?: string[];
  banMessage?: string;
  banNote?: string;
  removeContent?: string[];
  lockPosts?: boolean;
  muteUser?: boolean;
  markAsSpam?: boolean;
};

export const forms = new Hono();

forms.post('/ban-user-submit', async (c) => {
  const values = await c.req.json<BanUserValues>();

  const check = await checkModPermission(requiredBanPermissions(values.removeContent?.[0], Boolean(values.lockPosts)));
  if (!check.allowed) {
    return c.json<UiResponse>(permissionDeniedResponse(check), 200);
  }

  const rawDuration = values.banDuration?.[0] ?? 'permanent';
  const banDuration = rawDuration === 'permanent' ? undefined : parseInt(rawDuration);

  try {
    const subredditName = values.subRedditName ?? context.subredditName;
    const texts = await resolveBanTexts({
      subredditName,
      ruleId: values.ruleViolated?.[0],
      banMessage: values.banMessage,
      banNote: values.banNote,
    });
    const message = await banService.processBan({
      subredditName,
      username: values.username ?? '',
      banDuration,
      ...texts,
      removeContent: values.removeContent?.[0] ?? 'Do not remove',
      lockPosts: Boolean(values.lockPosts),
      muteUser: Boolean(values.muteUser),
      markAsSpam: Boolean(values.markAsSpam),
    });
    return c.json<UiResponse>({ showToast: message }, 200);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return c.json<UiResponse>({ showToast: `Error: ${msg}` }, 200);
  }
});

forms.post('/shadowban-user-submit', async (c) => {
  const values = await c.req.json<BanUserValues>();

  // A shadowban removes the user's future content through the submit triggers,
  // so it always requires 'posts' in addition to 'access'.
  const check = await checkModPermission(['access', 'posts']);
  if (!check.allowed) {
    return c.json<UiResponse>(permissionDeniedResponse(check), 200);
  }

  const rawDuration = values.banDuration?.[0] ?? 'permanent';
  const banDuration = rawDuration === 'permanent' ? undefined : parseInt(rawDuration);

  try {
    const subredditName = values.subRedditName ?? context.subredditName;
    // The shadowban form has no message field (the user is never notified); only the note is used.
    const texts = await resolveBanTexts({
      subredditName,
      ruleId: values.ruleViolated?.[0],
      banMessage: '',
      banNote: values.banNote,
    });
    const message = await shadowbanService.processShadowban({
      subredditName,
      username: values.username ?? '',
      banDuration,
      ...texts,
      removeContent: values.removeContent?.[0] ?? 'Do not remove',
      lockPosts: Boolean(values.lockPosts),
      muteUser: Boolean(values.muteUser),
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

  const check = await checkModPermission(requiredBanPermissions(values.removeContent?.[0], Boolean(values.lockPosts)));
  if (!check.allowed) {
    return c.json<UiResponse>(permissionDeniedResponse(check), 200);
  }

  if (!values.usernames?.trim()) {
    return c.json<UiResponse>({ showToast: 'No valid usernames provided' }, 200);
  }

  const rawDuration = values.banDuration?.[0] ?? 'permanent';
  const banDuration = rawDuration === 'permanent' ? undefined : parseInt(rawDuration);

  try {
    const subredditName = values.subRedditName ?? context.subredditName;
    const texts = await resolveBanTexts({
      subredditName,
      ruleId: values.ruleViolated?.[0],
      banMessage: values.banMessage,
      banNote: values.banNote,
    });
    const result = await banService.processBulkBan({
      subredditName,
      usernames: values.usernames,
      banDuration,
      ...texts,
      removeContent: values.removeContent?.[0] ?? 'Do not remove',
      lockPosts: Boolean(values.lockPosts),
      muteUser: Boolean(values.muteUser),
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

forms.post('/undo-ban-submit', async (c) => {
  const values = await c.req.json<UndoBanValues>();
  const restoreContent = Boolean(values.restoreContent);
  const unlockPosts = Boolean(values.unlockPosts);
  const unmuteUser = Boolean(values.unmuteUser);

  const check = await checkModPermission(requiredUnbanPermissions(restoreContent, unlockPosts));
  if (!check.allowed) {
    return c.json<UiResponse>(permissionDeniedResponse(check), 200);
  }

  const username = (values.username ?? '').trim().replace(/^\/?u\//i, '');
  if (!username) {
    return c.json<UiResponse>({ showToast: 'No username provided' }, 200);
  }

  const subredditName = values.subRedditName ?? context.subredditName;

  try {
    const matches = await reddit.getBannedUsers({ subredditName, username }).all();
    if (matches.length === 0) {
      // Not banned on Reddit's side: maybe shadowbanned by this app.
      const shadowban = await shadowbanService.getShadowbanRecord(subredditName, username);
      if (!shadowban) {
        return c.json<UiResponse>({ showToast: `u/${username} is neither banned nor shadowbanned in r/${subredditName}.` }, 200);
      }
      const message = await shadowbanService.processUnshadowban({
        subredditName,
        username: shadowban.username,
        restoreContent,
        unlockPosts,
        unmuteUser,
      });
      return c.json<UiResponse>({ showToast: message }, 200);
    }
    const canonicalUsername = matches[0]?.username ?? username;

    // A user can be both banned and shadowbanned; lift both so Undo Ban fully restores them.
    await shadowbanService.deleteShadowbanRecord(subredditName, canonicalUsername);

    const message = await banService.processUnban({
      subredditName,
      username: canonicalUsername,
      restoreContent,
      unlockPosts,
      unmuteUser,
    });
    return c.json<UiResponse>({ showToast: message }, 200);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return c.json<UiResponse>({ showToast: `Error: ${msg}` }, 200);
  }
});

forms.post('/export-banned-users-submit', async (c) => {
  return c.json<UiResponse>({ showToast: 'Banned users list exported' }, 200);
});
