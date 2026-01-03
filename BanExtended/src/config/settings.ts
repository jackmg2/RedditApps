import { SettingsFormField } from '@devvit/public-api';

export const settings: SettingsFormField[] = [
  {
    type: 'select',
    name: 'defaultBanDuration',
    label: 'Default Ban Duration',
    options: [
      { label: 'Permanent', value: 'permanent' },
      { label: '1 day', value: '1' },
      { label: '3 days', value: '3' },
      { label: '7 days', value: '7' },
      { label: '30 days', value: '30' },
    ],
    defaultValue: ['permanent'],
    multiSelect: false
  },
  {
    type: 'select',
    name: 'defaultRemoveContent',
    label: 'Default Content Removal Period',
    options: [
      { label: 'Do not remove', value: 'Do not remove' },
      { label: 'Last 24 hours', value: 'last 24 hours' },
      { label: 'Previous 3 days', value: 'previous 3 days' },
      { label: 'Previous 7 days', value: 'previous 7 days' },
      { label: 'All time', value: 'all time' },
    ],
    defaultValue: ['Do not remove'],
    multiSelect: false
  }
];