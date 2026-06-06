import { Hono } from 'hono';
import type { Form, UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import * as approvalService from '../core/approvalService.js';
import * as userService from '../core/userService.js';
import * as storageService from '../core/storageService.js';

type ApprovePostValues = {
  subRedditName?: string;
  username?: string;
  postId?: string;
  selectedFlair?: string[];
  comment?: string;
  approveUser?: boolean;
  approvePost?: boolean;
};

type ApproveCommentValues = {
  subRedditName?: string;
  username?: string;
  commentId?: string;
  selectedFlair?: string[];
  comment?: string;
  approveUser?: boolean;
  approveComment?: boolean;
};

type BulkApproveValues = {
  subRedditName?: string;
  usernames?: string;
  selectedFlair?: string[];
  approveUsers?: boolean;
};

type TimeRangeValues = {
  subRedditName?: string;
  timeRange?: string[];
};

type ExportUsersValues = {
  subRedditName?: string;
};

export const forms = new Hono();

function buildExportForm(data: {
  subredditName: string;
  selectedTimeRange: string;
  userList: string;
  total: number;
  lastExportDate?: string;
}): Form {
  const fields: Form['fields'] = [
    { name: 'subRedditName', label: 'SubReddit', type: 'string', disabled: true, defaultValue: data.subredditName },
    {
      name: 'timeRange',
      label: 'Time Range',
      type: 'string',
      disabled: true,
      defaultValue:
        data.selectedTimeRange === 'all'
          ? 'All Time'
          : data.selectedTimeRange === 'month'
            ? 'Past Month'
            : 'Past 7 Days',
      helpText: 'Selected time range for this export',
    },
  ];

  if (data.lastExportDate) {
    fields.push({ name: 'lastExport', label: 'Last Export', type: 'string', disabled: true, defaultValue: data.lastExportDate });
  }

  fields.push({
    name: 'approvedUsersList',
    label: 'Approved Users List',
    type: 'paragraph',
    helpText: 'Copy this semicolon-separated list of approved users',
    defaultValue: data.userList,
  });

  return {
    title: `Export Approved Users (${data.total} total)`,
    fields,
    acceptLabel: 'Done',
    cancelLabel: 'Close',
  };
}

forms.post('/approve-post-submit', async (c) => {
  const values = await c.req.json<ApprovePostValues>();

  const flairId = values.selectedFlair?.[0];

  try {
    const result = await approvalService.processApproval({
      subredditName: values.subRedditName ?? context.subredditName,
      username: values.username ?? '',
      flairTemplateId: flairId,
      postId: values.postId,
      commentId: undefined,
      approveUser: Boolean(values.approveUser),
      approvePost: Boolean(values.approvePost),
      approveComment: false,
      welcomeComment: values.comment ?? '',
    });

    return c.json<UiResponse>({ showToast: result }, 200);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return c.json<UiResponse>({ showToast: `Error: ${msg}` }, 200);
  }
});

forms.post('/approve-comment-submit', async (c) => {
  const values = await c.req.json<ApproveCommentValues>();

  const flairId = values.selectedFlair?.[0];

  try {
    const result = await approvalService.processApproval({
      subredditName: values.subRedditName ?? context.subredditName,
      username: values.username ?? '',
      flairTemplateId: flairId,
      postId: undefined,
      commentId: values.commentId,
      approveUser: Boolean(values.approveUser),
      approvePost: false,
      approveComment: Boolean(values.approveComment),
      welcomeComment: values.comment ?? '',
    });

    return c.json<UiResponse>({ showToast: result }, 200);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return c.json<UiResponse>({ showToast: `Error: ${msg}` }, 200);
  }
});

forms.post('/bulk-approve-submit', async (c) => {
  const values = await c.req.json<BulkApproveValues>();

  const flairId = values.selectedFlair?.[0];

  if (!values.usernames?.trim()) {
    return c.json<UiResponse>({ showToast: 'No valid usernames provided' }, 200);
  }

  try {
    const result = await approvalService.processBulkApproval({
      subredditName: values.subRedditName ?? context.subredditName,
      usernames: values.usernames,
      flairTemplateId: flairId,
      approveUsers: Boolean(values.approveUsers),
    });

    if (result.errorCount === 0) {
      return c.json<UiResponse>({ showToast: `✅ Successfully processed ${result.successCount} users` }, 200);
    }

    const errorSummary = result.errors.slice(0, 3).join('; ');
    const more = result.errors.length > 3 ? '...' : '';
    const toast =
      result.successCount > 0
        ? `✅ Processed ${result.successCount}. ❌ Failed ${result.errorCount}: ${errorSummary}${more}`
        : `❌ Failed to process ${result.errorCount} users. Errors: ${errorSummary}${more}`;

    return c.json<UiResponse>({ showToast: toast }, 200);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return c.json<UiResponse>({ showToast: `Error: ${msg}` }, 200);
  }
});

forms.post('/time-range-submit', async (c) => {
  const values = await c.req.json<TimeRangeValues>();
  const subredditName = values.subRedditName ?? context.subredditName;
  const selectedRange = (values.timeRange?.[0] ?? 'all') as 'all' | 'month' | 'week';

  try {
    const allUsers = await userService.getApprovedUsers(subredditName);

    if (allUsers.length === 0) {
      return c.json<UiResponse>({ showToast: 'No approved users found in this subreddit' }, 200);
    }

    let filteredUsers;
    if (selectedRange === 'all') {
      filteredUsers = allUsers;
    } else {
      const now = new Date();
      const startDate = new Date(
        now.getTime() - (selectedRange === 'month' ? 30 : 7) * 24 * 60 * 60 * 1000
      );
      const filteredUsernames = await userService.getContributorsInTimeRange(subredditName, startDate);

      if (filteredUsernames.size === 0) {
        return c.json<UiResponse>({ showToast: 'No approved users found for the selected time range' }, 200);
      }

      filteredUsers = allUsers.filter((u) => filteredUsernames.has(u.username.toLowerCase()));
    }

    if (filteredUsers.length === 0) {
      return c.json<UiResponse>({ showToast: 'No approved users found for the selected time range' }, 200);
    }

    const userList = userService.formatUsersForExport(filteredUsers);

    await storageService.storeLastExportDate(subredditName);

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
          name: 'exportUsers',
          form: buildExportForm({
            subredditName,
            selectedTimeRange: selectedRange,
            userList,
            total: filteredUsers.length,
            ...(lastExportFormatted && { lastExportDate: lastExportFormatted }),
          }),
        },
      },
      200
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return c.json<UiResponse>({ showToast: `Error fetching approved users: ${msg}` }, 200);
  }
});

forms.post('/export-users-submit', async (c) => {
  const values = await c.req.json<ExportUsersValues>();
  const subredditName = values.subRedditName ?? context.subredditName;

  await storageService.storeLastExportDate(subredditName);

  return c.json<UiResponse>({ showToast: 'Approved users list exported' }, 200);
});
