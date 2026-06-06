import { Hono } from 'hono';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import type { Form } from '@devvit/shared-types/shared/form.js';
import { isT1, isT3 } from '@devvit/shared-types/tid.js';
import { reddit, settings, context } from '@devvit/web/server';
import type { AppSettings } from '../types/AppSettings.js';
import type { FlairOption } from '../core/flairService.js';
import * as flairService from '../core/flairService.js';
import * as storageService from '../core/storageService.js';

export const menu = new Hono();

function buildApprovePostForm(data: {
  subredditName: string;
  username: string;
  postId: string;
  flairOptions: FlairOption[];
  defaultFlair: string[];
  defaultComment: string;
  defaultApproveUser: boolean;
  defaultApprovePost: boolean;
}): Form {
  const fields: Form['fields'] = [
    { name: 'subRedditName', label: 'SubReddit', type: 'string', disabled: true, defaultValue: data.subredditName },
    { name: 'username', label: 'Username', type: 'string', disabled: true, defaultValue: data.username },
    { name: 'postId', label: 'Post Id', type: 'string', disabled: true, defaultValue: data.postId },
  ];
  if (data.flairOptions.length > 0) {
    fields.push({ name: 'selectedFlair', type: 'select', label: 'Flair', options: data.flairOptions, defaultValue: data.defaultFlair, multiSelect: false });
  }
  fields.push(
    { name: 'comment', type: 'paragraph', label: 'Comment', defaultValue: data.defaultComment },
    { name: 'approveUser', type: 'boolean', label: 'Approve user', defaultValue: data.defaultApproveUser },
    { name: 'approvePost', type: 'boolean', label: 'Approve post', defaultValue: data.defaultApprovePost }
  );
  return { title: `Approve and apply flair to ${data.username}`, fields, acceptLabel: 'Submit', cancelLabel: 'Cancel' };
}

function buildApproveCommentForm(data: {
  subredditName: string;
  username: string;
  commentId: string;
  flairOptions: FlairOption[];
  defaultFlair: string[];
  defaultComment: string;
  defaultApproveUser: boolean;
  defaultApproveComment: boolean;
}): Form {
  const fields: Form['fields'] = [
    { name: 'subRedditName', label: 'SubReddit', type: 'string', disabled: true, defaultValue: data.subredditName },
    { name: 'username', label: 'Username', type: 'string', disabled: true, defaultValue: data.username },
    { name: 'commentId', label: 'Comment Id', type: 'string', disabled: true, defaultValue: data.commentId },
  ];
  if (data.flairOptions.length > 0) {
    fields.push({ name: 'selectedFlair', type: 'select', label: 'Flair', options: data.flairOptions, defaultValue: data.defaultFlair, multiSelect: false });
  }
  fields.push(
    { name: 'comment', type: 'paragraph', label: 'Comment', defaultValue: data.defaultComment },
    { name: 'approveUser', type: 'boolean', label: 'Approve user', defaultValue: data.defaultApproveUser },
    { name: 'approveComment', type: 'boolean', label: 'Approve comment', defaultValue: data.defaultApproveComment }
  );
  return { title: `Approve and apply flair to ${data.username}`, fields, acceptLabel: 'Submit', cancelLabel: 'Cancel' };
}

function buildBulkApproveForm(data: {
  subredditName: string;
  flairOptions: FlairOption[];
  defaultFlair: string[];
  defaultApproveUser: boolean;
}): Form {
  const fields: Form['fields'] = [
    { name: 'subRedditName', label: 'SubReddit', type: 'string', disabled: true, defaultValue: data.subredditName },
    { name: 'usernames', label: 'Usernames (semi-colon separated)', type: 'paragraph', helpText: 'Enter usernames separated by semi-colons (e.g., user1;user2;user3)', required: true },
  ];
  if (data.flairOptions.length > 0) {
    fields.push({ name: 'selectedFlair', type: 'select', label: 'Flair to Apply', options: data.flairOptions, defaultValue: data.defaultFlair, multiSelect: false });
  }
  fields.push({ name: 'approveUsers', type: 'boolean', label: 'Approve all users', defaultValue: data.defaultApproveUser, helpText: 'Check to approve all users in addition to applying flair' });
  return { title: 'Bulk Approve and Apply Flair', fields, acceptLabel: 'Process All Users', cancelLabel: 'Cancel' };
}

function buildTimeRangeForm(data: {
  subredditName: string;
  lastExportDate?: string;
}): Form {
  const fields: Form['fields'] = [
    { name: 'subRedditName', label: 'SubReddit', type: 'string', disabled: true, defaultValue: data.subredditName },
  ];

  if (data.lastExportDate) {
    fields.push({ name: 'lastExportInfo', label: 'Last Export', type: 'string', disabled: true, defaultValue: data.lastExportDate });
  }

  fields.push({
    name: 'timeRange',
    type: 'select',
    label: 'Time Range',
    options: [
      { label: 'All Time', value: 'all' },
      { label: 'Past Month', value: 'month' },
      { label: 'Past 7 Days', value: 'week' },
    ],
    defaultValue: ['all'],
    multiSelect: false,
    required: true,
    helpText: 'Select which approved users to export based on when they were approved',
  });

  return {
    title: 'Export Approved Users',
    fields,
    acceptLabel: 'Continue',
    cancelLabel: 'Cancel',
  };
}

menu.post('/verify-approve-post', async (c) => {
  const request = await c.req.json<MenuItemRequest>();
  const { targetId } = request;

  if (!isT3(targetId)) {
    return c.json<UiResponse>({ showToast: 'Invalid post ID.' }, 200);
  }

  try {
    const subredditName = context.subredditName;
    const [post, flairOptions, config] = await Promise.all([
      reddit.getPostById(targetId),
      flairService.getFlairTemplates(subredditName),
      settings.getAll<AppSettings>(),
    ]);

    return c.json<UiResponse>(
      {
        showForm: {
          name: 'approvePost',
          form: buildApprovePostForm({
            subredditName,
            username: post.authorName,
            postId: post.id,
            flairOptions,
            defaultFlair: flairOptions.length > 0 ? [flairOptions[0].value] : [],
            defaultComment: config.defaultComment ?? 'Welcome to the community!',
            defaultApproveUser: config.defaultValueApproveUser ?? true,
            defaultApprovePost: config.defaultValueApprovePost ?? true,
          }),
        },
      },
      200
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return c.json<UiResponse>({ showToast: `Error: ${msg}` }, 200);
  }
});

menu.post('/verify-approve-comment', async (c) => {
  const request = await c.req.json<MenuItemRequest>();
  const { targetId } = request;

  if (!isT1(targetId)) {
    return c.json<UiResponse>({ showToast: 'Invalid comment ID.' }, 200);
  }

  try {
    const subredditName = context.subredditName;
    const [comment, flairOptions, config] = await Promise.all([
      reddit.getCommentById(targetId),
      flairService.getFlairTemplates(subredditName),
      settings.getAll<AppSettings>(),
    ]);

    return c.json<UiResponse>(
      {
        showForm: {
          name: 'approveComment',
          form: buildApproveCommentForm({
            subredditName,
            username: comment.authorName,
            commentId: comment.id,
            flairOptions,
            defaultFlair: flairOptions.length > 0 ? [flairOptions[0].value] : [],
            defaultComment: config.defaultComment ?? 'Welcome to the community!',
            defaultApproveUser: config.defaultValueApproveUser ?? true,
            defaultApproveComment: config.defaultValueApproveComment ?? true,
          }),
        },
      },
      200
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return c.json<UiResponse>({ showToast: `Error: ${msg}` }, 200);
  }
});

menu.post('/bulk-approve', async (c) => {
  try {
    const subredditName = context.subredditName;
    const [flairOptions, config] = await Promise.all([
      flairService.getFlairTemplates(subredditName),
      settings.getAll<AppSettings>(),
    ]);

    return c.json<UiResponse>(
      {
        showForm: {
          name: 'bulkApprove',
          form: buildBulkApproveForm({
            subredditName,
            flairOptions,
            defaultFlair: flairOptions.length > 0 ? [flairOptions[0].value] : [],
            defaultApproveUser: config.defaultValueApproveUser ?? true,
          }),
        },
      },
      200
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return c.json<UiResponse>({ showToast: `Error loading bulk approve form: ${msg}` }, 200);
  }
});

menu.post('/export-approved-users', async (c) => {
  try {
    const subredditName = context.subredditName;
    const lastExportDate = await storageService.getLastExportDate(subredditName);

    let lastExportFormatted: string | undefined;
    if (lastExportDate) {
      lastExportFormatted = lastExportDate.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    return c.json<UiResponse>(
      {
        showForm: {
          name: 'timeRangeSelection',
          form: buildTimeRangeForm({
            subredditName,
            ...(lastExportFormatted && { lastExportDate: lastExportFormatted }),
          }),
        },
      },
      200
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return c.json<UiResponse>({ showToast: `Error: ${msg}` }, 200);
  }
});
