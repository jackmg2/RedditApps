import { SettingsFormField } from '@devvit/public-api';

export const settings: SettingsFormField[] = [  
  {
    name: 'titleUpcoming',
    label: 'Upcoming Events Title',
    type: 'string',
    helpText: 'Title for all other upcoming events.',
    defaultValue: 'Upcoming events'
  },
];