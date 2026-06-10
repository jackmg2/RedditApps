import { Hono } from 'hono';
import { reddit, settings, context } from '@devvit/web/server';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import type { Form } from '@devvit/shared-types/shared/form.js';
import { isT1 } from '@devvit/shared-types/tid.js';
import type { AppSettings } from '../types/appSettings.js';
import * as userService from '../core/userService.js';

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

function buildBanUserForm(data: {
  subredditName: string;
  username: string;
  subredditRules: { label: string; value: string }[];
  defaultBanDuration: string;
  defaultRemoveContent: string;
}): Form {
  return {
    title: `Ban ${data.username}`,
    fields: [
      { name: 'subRedditName', label: 'SubReddit', type: 'string', disabled: true, defaultValue: data.subredditName },
      { name: 'username', label: 'Username', type: 'string', disabled: true, defaultValue: data.username },
      { name: 'banDuration', label: 'Ban Duration', type: 'select', options: BAN_DURATION_OPTIONS, defaultValue: [data.defaultBanDuration], multiSelect: false, required: true },
      { name: 'ruleViolated', label: 'Rule Violated', type: 'select', options: data.subredditRules },
      { name: 'banMessage', label: 'Ban Message', type: 'string', helpText: 'Message sent to the banned user' },
      { name: 'removeContent', label: "Remove user's content posted", type: 'select', options: REMOVE_CONTENT_OPTIONS, defaultValue: [data.defaultRemoveContent], multiSelect: false },
      { name: 'markAsSpam', label: 'Mark as spam', type: 'boolean' },
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
}): Form {
  return {
    title: 'Bulk Ban Users',
    fields: [
      { name: 'subRedditName', label: 'SubReddit', type: 'string', disabled: true, defaultValue: data.subredditName },
      { name: 'usernames', label: 'Usernames (semi-colon separated)', type: 'paragraph', helpText: 'Enter usernames separated by semi-colons (e.g., user1;user2;user3)', required: true },
      { name: 'banDuration', label: 'Ban Duration', type: 'select', options: BAN_DURATION_OPTIONS, defaultValue: [data.defaultBanDuration], multiSelect: false, required: true },
      { name: 'ruleViolated', label: 'Rule Violated', type: 'select', options: data.subredditRules, required: true },
      { name: 'banMessage', label: 'Ban Message', type: 'string', helpText: 'Message sent to all banned users' },
      { name: 'removeContent', label: "Remove users' content posted", type: 'select', options: REMOVE_CONTENT_OPTIONS, defaultValue: [data.defaultRemoveContent], multiSelect: false },
      { name: 'markAsSpam', label: 'Mark as spam', type: 'boolean' },
    ],
    acceptLabel: 'Process All Users',
    cancelLabel: 'Cancel',
  };
}

menu.post('/ban-user', async (c) => {
  const request = await c.req.json<MenuItemRequest>();
  const targetId = request.targetId;
  const subredditName = context.subredditName;

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
      return c.json<UiResponse>({ showToast: 'Could not retrieve the post/comment author.' }, 200);
    }

    const defaultBanDuration = appSettings.defaultBanDuration ?? 'permanent';
    const defaultRemoveContent = appSettings.defaultRemoveContent ?? 'Do not remove';
    const rules = subredditRules.map((r) => ({ label: r.title, value: r.message }));

    return c.json<UiResponse>(
      {
        showForm: {
          name: 'banUser',
          form: buildBanUserForm({ subredditName, username: author.username, subredditRules: rules, defaultBanDuration, defaultRemoveContent }),
        },
      },
      200
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return c.json<UiResponse>({ showToast: `Error: ${msg}` }, 200);
  }
});

menu.post('/bulk-ban-users', async (c) => {
  const subredditName = context.subredditName;

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
    const rules = subredditRules.map((r) => ({ label: r.title, value: r.message }));

    return c.json<UiResponse>(
      {
        showForm: {
          name: 'bulkBan',
          form: buildBulkBanForm({ subredditName, subredditRules: rules, defaultBanDuration, defaultRemoveContent }),
        },
      },
      200
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return c.json<UiResponse>({ showToast: `Error: ${msg}` }, 200);
  }
});

menu.post('/export-banned-users', async (c) => {
  const subredditName = context.subredditName;

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
