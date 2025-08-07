import { SettingsFormField } from '@devvit/public-api';

export const settings: SettingsFormField[] = [
  {
    type: 'number',
    name: 'ratioValue',
    label: 'Ratio value, for one tracked post, you can do x other posts.',
    defaultValue: 3,
  },
  {
    type: 'string',
    name: 'monitoredFlair',
    label: 'Tracked post flair, you can add multiple with a semicolon.',
    defaultValue: 'Your post flair;Your second post flair',
  },
  {
    type: 'paragraph',
    name: 'ratioViolationComment',
    label: 'Comment for ratio violation',
    defaultValue: 'Your post has been removed due to exceeding the allowed post ratio.',
  },
  {
    type: 'paragraph',
    name: 'wrongFlairComment',
    label: 'Comment after modifying a wrong flair',
    defaultValue: '',
  }
];