import { Devvit, FormOnSubmitEvent, JSONObject } from '@devvit/public-api';
import { StorageService } from '../services/storageService.js';

interface ExportUsersFormValues {
  subRedditName: string;
}

export const onExportUsersHandler = async (
  event: FormOnSubmitEvent<JSONObject>,
  context: Devvit.Context
) => {
  const { subRedditName } = event.values;
  
  // Store the export timestamp
  await StorageService.storeLastExportDate(context, subRedditName as string);
  
  context.ui.showToast('Approved users list exported');
};

interface ExportUsersFormData {
  subRedditName: string;
  userList: string;
  total: string;
  selectedTimeRange: string;
  lastExportDate?: string;
}

export const modalExportApprovedUsers = Devvit.createForm((data) => {
  const fields = [
    {
      name: 'subRedditName',
      label: 'SubReddit',
      type: 'string' as const,
      disabled: true,
      defaultValue: data.subRedditName
    },
    {
      name: 'timeRange',
      label: 'Time Range',
      type: 'string' as const,
      disabled: true,
      defaultValue: data.selectedTimeRange === 'all' ? 'All Time' : 
                    data.selectedTimeRange === 'month' ? 'Past Month' : 'Past 7 Days',
      helpText: 'Selected time range for this export'
    }
  ];

  // Only add lastExport field if it exists
  if (data.lastExportDate) {
    fields.push({
      name: 'lastExport',
      label: 'Last Export',
      type: 'string' as const,
      disabled: true,
      defaultValue: data.lastExportDate
    });
  }

  fields.push({
    name: 'approvedUsersList',
    label: 'Approved Users List',
    helpText: 'Copy this semicolon-separated list of approved users',
    defaultValue: data.userList,
    disabled: false
  });

  return {
    title: `Export Approved Users (${data.total} total)`,
    fields: fields,
    acceptLabel: 'Done',
    cancelLabel: 'Close',
  };
}, onExportUsersHandler);