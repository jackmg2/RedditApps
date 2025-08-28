// src/config/settings.ts
import { SettingsFormField } from '@devvit/public-api';

export const settings: SettingsFormField[] = [
  {
    type: 'boolean',
    name: 'invertedRatio',
    label: 'Inverted Ratio Mode',
    helpText: 'When enabled, limits how often users can post with monitored flairs (e.g., 1 Question post per 3 regular posts)',
    defaultValue: false,
  },
  {
    type: 'number',
    name: 'ratioValue',
    label: 'Ratio value',
    helpText: 'Normal mode: X regular posts allowed per 1 monitored post. Inverted mode: X regular posts required per 1 monitored post.',
    defaultValue: 3,
  },
  {
    type: 'string',
    name: 'monitoredFlair',
    label: 'Tracked post flair, you can add multiple with a semicolon.',
    defaultValue: 'Your post flair;Your second post flair',
  },
  {
    type: 'string',
    name: 'exemptUsers',
    label: 'Exempt usernames (separated by semicolons)',
    helpText: 'Users listed here will not be affected by ratio rules and won\'t have ratios displayed in their flairs. Example: admin;moderator;bot',
    defaultValue: '',
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