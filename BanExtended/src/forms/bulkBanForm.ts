import { Devvit, FormOnSubmitEvent, JSONObject } from '@devvit/public-api';
import { BanService } from '../services/banService.js';

export const onBulkBanHandler = async (
  event: FormOnSubmitEvent<JSONObject>,
  context: Devvit.Context
) => {
  await BanService.processBulkBan(event.values, context);
};

export const modalBulkBan = Devvit.createForm((data) => ({
  title: 'Bulk Ban Users',
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
      label: 'Usernames (semicolon-separated)',
      type: 'paragraph',
      helpText: 'Enter usernames separated by semicolons (e.g., user1;user2;user3)',
      required: true
    },
    {
      type: 'select',
      name: 'banDuration',
      label: 'Ban Duration',
      options: [
        { label: 'Permanent', value: 'permanent' },
        { label: '1 day', value: '1' },
        { label: '3 days', value: '3' },
        { label: '7 days', value: '7' },
        { label: '30 days', value: '30' },
      ],
      defaultValue: [data.defaultBanDuration],
      multiSelect: false,
      required: true
    },
    {
      name: 'ruleViolated',
      type: 'select',
      label: 'Rule Violated',
      options: data.subredditRules,
      required: true
    },
    {
      name: 'banMessage',
      type: 'string',
      label: 'Ban Message',
      placeholder: 'Enter a message to send to all users',
    },
    {
      name: 'removeContent',
      type: 'select',
      label: 'Remove all users\' content posted',
      options: [
        { label: 'Do not remove', value: 'Do not remove' },
        { label: 'Last 24 hours', value: 'last 24 hours' },
        { label: 'Previous 3 days', value: 'previous 3 days' },
        { label: 'Previous 7 days', value: 'previous 7 days' },
        { label: 'All time', value: 'all time' },
      ],
      defaultValue: [data.defaultRemoveContent],
      multiSelect: false
    },
    {
      name: 'markAsSpam',
      type: 'boolean',
      label: 'Mark as spam',
    }
  ],
  acceptLabel: 'Ban All Users',
  cancelLabel: 'Cancel',
}), onBulkBanHandler);