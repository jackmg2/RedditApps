import { SettingsFormField } from '@devvit/public-api';

export const settings: SettingsFormField[] = [
  {
    name: 'titleNow',
    label: 'Now Events Title',
    type: 'string',
    helpText: 'Title for events happening right now (today without time, or currently active events).',
    defaultValue: 'Now'
  },
  {
    name: 'titleUpcoming',
    label: 'Upcoming Events Title',
    type: 'string',
    helpText: 'Title for all other upcoming events.',
    defaultValue: 'Upcoming events'
  },
];