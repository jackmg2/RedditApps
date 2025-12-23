import { Devvit, FormOnSubmitEvent, JSONObject } from '@devvit/public-api';
import { UserService } from '../services/userService.js';
import { StorageService } from '../services/storageService.js';
import { modalExportApprovedUsers } from './exportUsersForm.js';

interface TimeRangeFormValues {
  subRedditName: string;
  timeRange: string[];
}

export const onTimeRangeSelectionHandler = async (
  event: FormOnSubmitEvent<JSONObject>,
  context: Devvit.Context
) => {
  const values = event.values as unknown as TimeRangeFormValues;
  const { subRedditName, timeRange } = values;

  try {
    context.ui.showToast('Fetching approved users...');

    // Get all approved users from Reddit
    const allApprovedUsers = await UserService.getApprovedUsers(
      context,
      subRedditName
    );

    if (allApprovedUsers.length === 0) {
      context.ui.showToast('No approved users found in this subreddit');
      return;
    }

    // Get filtered usernames based on time range
    const selectedRange = timeRange[0] as 'all' | 'month' | 'week';
    let filteredUsers;

    if (selectedRange === 'all') {
      // For 'all', include everyone
      filteredUsers = allApprovedUsers;
    } else {
      // Get users approved within the time range
      const filteredUsernames = await StorageService.getFilteredUsernames(
        context,
        subRedditName,
        selectedRange
      );

      if (filteredUsernames.size === 0) {
        context.ui.showToast(`No approved users found for the selected time range`);
        return;
      }

      // Filter the approved users list
      filteredUsers = allApprovedUsers.filter(user =>
        filteredUsernames.has(user.username)
      );
    }

    if (filteredUsers.length === 0) {
      context.ui.showToast(`No approved users found for the selected time range`);
      return;
    }

    const userList = UserService.formatUsersForExport(filteredUsers);
    const lastExportDate = await StorageService.getLastExportDate(
      context,
      subRedditName
    );

    let lastExportFormatted: string | undefined = undefined;
    if (lastExportDate) {
      lastExportFormatted = lastExportDate.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    const formData: any = {
      subRedditName: subRedditName,
      userList: userList,
      total: filteredUsers.length.toString(),
      selectedTimeRange: selectedRange
    };

    // Only include lastExportDate if it exists
    if (lastExportFormatted) {
      formData.lastExportDate = lastExportFormatted;
    }

    context.ui.showForm(modalExportApprovedUsers, formData);

  } catch (error) {
    if (error instanceof Error) {
      context.ui.showToast(`Error fetching approved users: ${error.message}`);
    } else {
      context.ui.showToast('Error fetching approved users');
    }
  }
};

export const modalTimeRangeSelection = Devvit.createForm((data) => {
  const fields = [
    {
      name: 'subRedditName',
      label: 'SubReddit',
      type: 'string' as const,
      disabled: true,
      defaultValue: data.subRedditName
    }
  ];

  // Only add lastExportInfo field if lastExportDate exists
  if (data.lastExportDate) {
    fields.push({
      name: 'lastExportInfo',
      label: 'Last Export',
      type: 'string' as const,
      disabled: true,
      defaultValue: data.lastExportDate
    });
  }

  fields.push({
    name: 'timeRange',
    label: 'Time Range',
    multiSelect: false,
    type: 'select',
    options: [
      { label: 'All Time', value: 'all' },
      { label: 'Past Month', value: 'month' },
      { label: 'Past 7 Days', value: 'week' }
    ],
    defaultValue: 'all',
    helpText: 'Select which approved users to export based on when they were approved',
    required: true
  });

  return {
    title: 'Export Approved Users',
    fields: fields,
    acceptLabel: 'Continue',
    cancelLabel: 'Cancel',
  };
}, onTimeRangeSelectionHandler);