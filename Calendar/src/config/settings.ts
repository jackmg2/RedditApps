import { SettingsFormField } from '@devvit/public-api';

export const settings: SettingsFormField[] = [
  {
    name: 'titleRightNow',
    label: 'Today Events Title',
    type: 'string',
    helpText: 'Title of events happening just today.',
    defaultValue: 'Today'
  },
  {
    name: 'titleThisMonth',
    label: 'This Month Events Title',
    type: 'string',
    helpText: 'Title of events happening during the whole month.',
    defaultValue: 'This month'
  },
  {
    name: 'titleFuture',
    label: 'Future Events Title',
    type: 'string',
    helpText: 'Title of events happening in the future.',
    defaultValue: 'Coming soon'
  },
];