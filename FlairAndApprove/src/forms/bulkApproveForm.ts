import { Devvit, FormOnSubmitEvent, JSONObject } from '@devvit/public-api';
import { ApprovalService } from '../services/approvalService.js';

export const onBulkApproveHandler = async (
  event: FormOnSubmitEvent<JSONObject>,
  context: Devvit.Context
) => {
  await ApprovalService.processBulkApproval(event.values, context);
};

export const modalBulkApprove = Devvit.createForm((data) => ({
  title: 'Bulk Approve and Apply Flair',
  fields: [
    {
      name: 'subRedditName',
      label: 'SubReddit',
      type: 'string',
      disabled: true,
      defaultValue: data.subRedditName
    },
    {
      name: 'usernames',
      label: 'Usernames (comma-separated)',
      type: 'paragraph',
      helpText: 'Enter usernames separated by commas (e.g., user1, user2, user3)',
      required: true
    },
    {
      name: 'selectedFlair',
      type: 'select',
      label: 'Flair to Apply',
      options: data.flairTemplates,
      defaultValue: data.defaultFlair,
      multiSelect: false,
      required: true
    },
    {
      name: 'approveUsers',
      type: 'boolean',
      label: 'Approve all users',
      defaultValue: data.defaultValueApproveUser,
      helpText: 'Check to approve all users in addition to applying flair'
    }
  ],
  acceptLabel: 'Process All Users',
  cancelLabel: 'Cancel',
}), onBulkApproveHandler);