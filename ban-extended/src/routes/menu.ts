import { Hono } from 'hono';
import { reddit, settings, context } from '@devvit/web/server';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import type { Form, FormField } from '@devvit/shared-types/shared/form.js';
import { isT1 } from '@devvit/shared-types/tid.js';
import type { AppSettings } from '../types/AppSettings.js';
import * as userService from '../core/userService.js';
import { checkModPermission, permissionDeniedResponse, type ModPermission } from '../toolkit/modPermissions.js';

export const menu = new Hono();

const BAN_DURATION_OPTIONS = [
  { label: 'Permanent', value: 'permanent' },
  { label: '1 day', value: '1' },
  { label: '3 days', value: '3' },
  { label: '7 days', value: '7' },
  { label: '30 days', value: '30' },
];

const REMOVE_CONTENT_OPTIONS = [
  { label: 'Do not remove', value: 'Do not remove' },
  { label: 'Last 24 hours', value: 'last 24 hours' },
  { label: 'Previous 3 days', value: 'previous 3 days' },
  { label: 'Previous 7 days', value: 'previous 7 days' },
  { label: 'All time', value: 'all time' },
];

// The lock and mute toggles are omitted from the form when the subreddit hides them; an absent
// field submits as undefined, so hiding also deactivates the action regardless of the default.
function optionalToggle(name: 'lockPosts' | 'muteUser', show: boolean, defaultValue: boolean, label: string, helpText: string): FormField[] {
  return show ? [{ name, label, type: 'boolean', defaultValue, helpText }] : [];
}

const MUTE_HELP = 'Prevents the user from sending modmail to this community for 28 days (Reddit maximum). Reddit notifies the user.';

type BanMode = 'ban' | 'shadowban';

const PLACEHOLDER_HELP = 'Placeholders: {rule} = the broken rule, {ruleMessage} = its removal reason text.';

type TextFieldSettings = {
  showMessageField: boolean;
  defaultBanMessage: string;
  showNoteField: boolean;
  defaultBanNote: string;
};

function readTextFieldSettings(appSettings: AppSettings): TextFieldSettings {
  return {
    showMessageField: appSettings.showMessageField ?? true,
    defaultBanMessage: appSettings.defaultBanMessage ?? '',
    showNoteField: appSettings.showNoteField ?? true,
    defaultBanNote: appSettings.defaultBanNote ?? '',
  };
}

// The message and note fields are pre-filled with the templates from the settings; the
// placeholders are resolved at submit time, once the rule is known. A hidden field submits
// as undefined, which makes the submit handler fall back to the template from the settings.
// A shadowban never notifies the user, so its form has no message field, only the note.
function textFields(mode: BanMode | 'bulk', s: TextFieldSettings): FormField[] {
  const fields: FormField[] = [];
  if (mode !== 'shadowban' && s.showMessageField) {
    fields.push({
      name: 'banMessage',
      label: 'Ban Message',
      type: 'paragraph',
      ...(s.defaultBanMessage ? { defaultValue: s.defaultBanMessage } : {}),
      helpText: `Sent to the banned user${mode === 'bulk' ? 's' : ''}. ${PLACEHOLDER_HELP}`,
    });
  }
  if (s.showNoteField) {
    fields.push({
      name: 'banNote',
      label: 'Mod Note',
      type: 'string',
      ...(s.defaultBanNote ? { defaultValue: s.defaultBanNote } : {}),
      helpText:
        mode === 'shadowban'
          ? `Added to the user's mod notes as "Shadowbanned: [rule] - [note]". The user is not notified. ${PLACEHOLDER_HELP}`
          : `Only moderators see it, in the ban list. 300 characters max. ${PLACEHOLDER_HELP}`,
    });
  }
  return fields;
}

// Same fields for both modes; only the wording differs.
function buildBanUserForm(data: {
  mode: BanMode;
  subredditName: string;
  username: string;
  subredditRules: { label: string; value: string }[];
  defaultBanDuration: string;
  defaultRemoveContent: string;
  showLockOption: boolean;
  defaultLockPosts: boolean;
  showMuteOption: boolean;
  defaultMuteUser: boolean;
  textSettings: TextFieldSettings;
}): Form {
  const shadow = data.mode === 'shadowban';
  return {
    title: shadow ? `Shadowban ${data.username}` : `Ban ${data.username}`,
    fields: [
      { name: 'subRedditName', label: 'SubReddit', type: 'string', disabled: true, defaultValue: data.subredditName },
      { name: 'username', label: 'Username', type: 'string', disabled: true, defaultValue: data.username },
      { name: 'banDuration', label: shadow ? 'Shadowban Duration' : 'Ban Duration', type: 'select', options: BAN_DURATION_OPTIONS, defaultValue: [data.defaultBanDuration], multiSelect: false, required: true },
      { name: 'ruleViolated', label: 'Rule Violated', type: 'select', options: data.subredditRules },
      ...textFields(data.mode, data.textSettings),
      { name: 'removeContent', label: "Remove user's content posted", type: 'select', options: REMOVE_CONTENT_OPTIONS, defaultValue: [data.defaultRemoveContent], multiSelect: false },
      ...optionalToggle('lockPosts', data.showLockOption, data.defaultLockPosts, "Lock all user's existing posts", 'Locks every existing post by this user in this subreddit'),
      ...optionalToggle('muteUser', data.showMuteOption, data.defaultMuteUser, 'Mute user from modmail', shadow ? `${MUTE_HELP} This can reveal the shadowban.` : MUTE_HELP),
      { name: 'markAsSpam', label: 'Mark as spam', type: 'boolean', helpText: shadow ? 'Also applies to the posts and comments removed automatically while shadowbanned' : undefined },
    ],
    acceptLabel: 'Submit',
    cancelLabel: 'Cancel',
  };
}

function buildBulkBanForm(data: {
  subredditName: string;
  subredditRules: { label: string; value: string }[];
  defaultBanDuration: string;
  defaultRemoveContent: string;
  showLockOption: boolean;
  defaultLockPosts: boolean;
  showMuteOption: boolean;
  defaultMuteUser: boolean;
  textSettings: TextFieldSettings;
}): Form {
  return {
    title: 'Bulk Ban Users',
    fields: [
      { name: 'subRedditName', label: 'SubReddit', type: 'string', disabled: true, defaultValue: data.subredditName },
      { name: 'usernames', label: 'Usernames (comma or semicolon separated)', type: 'paragraph', helpText: 'Enter usernames separated by commas or semicolons (e.g., user1;user2 or user1,user2)', required: true },
      { name: 'banDuration', label: 'Ban Duration', type: 'select', options: BAN_DURATION_OPTIONS, defaultValue: [data.defaultBanDuration], multiSelect: false, required: true },
      { name: 'ruleViolated', label: 'Rule Violated', type: 'select', options: data.subredditRules, required: true },
      ...textFields('bulk', data.textSettings),
      { name: 'removeContent', label: "Remove users' content posted", type: 'select', options: REMOVE_CONTENT_OPTIONS, defaultValue: [data.defaultRemoveContent], multiSelect: false },
      ...optionalToggle('lockPosts', data.showLockOption, data.defaultLockPosts, "Lock all users' existing posts", 'Locks every existing post by these users in this subreddit'),
      ...optionalToggle('muteUser', data.showMuteOption, data.defaultMuteUser, 'Mute users from modmail', 'Prevents these users from sending modmail to this community for 28 days (Reddit maximum). Reddit notifies them.'),
      { name: 'markAsSpam', label: 'Mark as spam', type: 'boolean' },
    ],
    acceptLabel: 'Process All Users',
    cancelLabel: 'Cancel',
  };
}

function buildUndoBanForm(subredditName: string): Form {
  return {
    title: 'Undo Ban',
    fields: [
      { name: 'subRedditName', label: 'SubReddit', type: 'string', disabled: true, defaultValue: subredditName },
      { name: 'username', label: 'Username', type: 'string', required: true, helpText: 'The banned or shadowbanned user to unban (with or without u/ prefix)' },
      { name: 'restoreContent', label: 'Re-approve content removed by this app', type: 'boolean', defaultValue: true, helpText: 'Only content this app removed at ban time can be restored. Bans made before this feature have no restore data.' },
      { name: 'unlockPosts', label: 'Unlock posts locked by this app', type: 'boolean', defaultValue: true },
      { name: 'unmuteUser', label: 'Unmute the user if this app muted them', type: 'boolean', defaultValue: true },
    ],
    acceptLabel: 'Undo Ban',
    cancelLabel: 'Cancel',
  };
}

// Banning only needs 'access'. A shadowban always removes content (via the submit
// triggers) so it needs 'posts' as well, whatever the form options.
const MENU_PERMISSIONS: Record<BanMode, ModPermission[]> = {
  ban: ['access'],
  shadowban: ['access', 'posts'],
};

async function openBanForm(request: MenuItemRequest, mode: BanMode): Promise<UiResponse> {
  const targetId = request.targetId;
  const subredditName = context.subredditName;

  const check = await checkModPermission(MENU_PERMISSIONS[mode]);
  if (!check.allowed) {
    return permissionDeniedResponse(check);
  }

  try {
    let authorId: string | undefined;

    if (isT1(targetId)) {
      const comment = await reddit.getCommentById(targetId);
      authorId = comment.authorId;
    } else {
      const post = await reddit.getPostById(targetId as `t3_${string}`);
      authorId = post.authorId;
    }

    const [author, subredditRules, appSettings] = await Promise.all([
      reddit.getUserById(authorId as `t2_${string}`),
      reddit.getSubredditRemovalReasons(subredditName),
      settings.getAll<AppSettings>(),
    ]);

    if (!author) {
      return { showToast: 'Could not retrieve the post/comment author.' };
    }

    const defaultBanDuration = appSettings.defaultBanDuration ?? 'permanent';
    const defaultRemoveContent = appSettings.defaultRemoveContent ?? 'Do not remove';
    const showLockOption = appSettings.showLockOption ?? true;
    const defaultLockPosts = appSettings.defaultLockPosts ?? false;
    const showMuteOption = appSettings.showMuteOption ?? true;
    const defaultMuteUser = appSettings.defaultMuteUser ?? false;
    const textSettings = readTextFieldSettings(appSettings);
    // The select carries the removal reason id; the submit handler resolves the rule's
    // title (ban reason) and message ({ruleMessage} placeholder) from it.
    const rules = subredditRules.map((r) => ({ label: r.title, value: r.id }));

    return {
      showForm: {
        name: mode === 'shadowban' ? 'shadowbanUser' : 'banUser',
        form: buildBanUserForm({ mode, subredditName, username: author.username, subredditRules: rules, defaultBanDuration, defaultRemoveContent, showLockOption, defaultLockPosts, showMuteOption, defaultMuteUser, textSettings }),
      },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { showToast: `Error: ${msg}` };
  }
}

menu.post('/ban-user', async (c) => {
  const request = await c.req.json<MenuItemRequest>();
  return c.json<UiResponse>(await openBanForm(request, 'ban'), 200);
});

menu.post('/shadowban-user', async (c) => {
  const request = await c.req.json<MenuItemRequest>();
  return c.json<UiResponse>(await openBanForm(request, 'shadowban'), 200);
});

menu.post('/bulk-ban-users', async (c) => {
  const subredditName = context.subredditName;

  const check = await checkModPermission(['access']);
  if (!check.allowed) {
    return c.json<UiResponse>(permissionDeniedResponse(check), 200);
  }

  try {
    const [subredditRules, appSettings] = await Promise.all([
      reddit.getSubredditRemovalReasons(subredditName),
      settings.getAll<AppSettings>(),
    ]);

    if (subredditRules.length === 0) {
      return c.json<UiResponse>({ showToast: 'No removal reasons available in this subreddit.' }, 200);
    }

    const defaultBanDuration = appSettings.defaultBanDuration ?? 'permanent';
    const defaultRemoveContent = appSettings.defaultRemoveContent ?? 'Do not remove';
    const showLockOption = appSettings.showLockOption ?? true;
    const defaultLockPosts = appSettings.defaultLockPosts ?? false;
    const showMuteOption = appSettings.showMuteOption ?? true;
    const defaultMuteUser = appSettings.defaultMuteUser ?? false;
    const textSettings = readTextFieldSettings(appSettings);
    const rules = subredditRules.map((r) => ({ label: r.title, value: r.id }));

    return c.json<UiResponse>(
      {
        showForm: {
          name: 'bulkBan',
          form: buildBulkBanForm({ subredditName, subredditRules: rules, defaultBanDuration, defaultRemoveContent, showLockOption, defaultLockPosts, showMuteOption, defaultMuteUser, textSettings }),
        },
      },
      200
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return c.json<UiResponse>({ showToast: `Error: ${msg}` }, 200);
  }
});

menu.post('/undo-ban', async (c) => {
  const subredditName = context.subredditName;

  const check = await checkModPermission(['access']);
  if (!check.allowed) {
    return c.json<UiResponse>(permissionDeniedResponse(check), 200);
  }

  return c.json<UiResponse>(
    {
      showForm: {
        name: 'undoBan',
        form: buildUndoBanForm(subredditName),
      },
    },
    200
  );
});

menu.post('/export-banned-users', async (c) => {
  const subredditName = context.subredditName;

  const check = await checkModPermission(['access']);
  if (!check.allowed) {
    return c.json<UiResponse>(permissionDeniedResponse(check), 200);
  }

  try {
    const bannedUsers = await userService.getBannedUsers(subredditName);

    if (bannedUsers.length === 0) {
      return c.json<UiResponse>({ showToast: 'No banned users found in this subreddit.' }, 200);
    }

    const userList = userService.formatUsersForExport(bannedUsers);

    return c.json<UiResponse>(
      {
        showForm: {
          name: 'exportBannedUsers',
          form: {
            title: `Export Banned Users (${bannedUsers.length} total)`,
            fields: [
              { name: 'subRedditName', label: 'SubReddit', type: 'string', disabled: true, defaultValue: subredditName },
              { name: 'bannedUsersList', label: 'Banned Users List', type: 'paragraph', helpText: 'Copy this semicolon-separated list of banned users', defaultValue: userList },
            ],
            acceptLabel: 'Done',
            cancelLabel: 'Close',
          },
        },
      },
      200
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return c.json<UiResponse>({ showToast: `Error: ${msg}` }, 200);
  }
});
