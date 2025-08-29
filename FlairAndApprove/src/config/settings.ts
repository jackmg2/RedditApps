import { SettingsFormField } from '@devvit/public-api';

export const settings: SettingsFormField[] = [
  {
    type: 'paragraph',
    name: 'defaultComment',
    label: 'Default Comment',
    helpText: 'The default comment to post when approving users',
    defaultValue: 'Welcome to the community!'
  },
  {
    type: 'boolean',
    name: 'defaultValueApproveUser',
    label: 'Auto-approve user by default',
    helpText: 'Whether the "Approve user" checkbox is checked by default',
    defaultValue: true
  },
  {
    type: 'boolean',
    name: 'defaultValueApprovePost',
    label: 'Auto-approve post by default',
    helpText: 'Whether the "Approve post" checkbox is checked by default',
    defaultValue: true
  },
  {
    type: 'boolean',
    name: 'defaultValueApproveComment',
    label: 'Auto-approve comment by default',
    helpText: 'Whether the "Approve comment" checkbox is checked by default',
    defaultValue: true
  },
  {
    type: 'boolean',
    name: 'autoAddModNote',
    label: 'Auto-add mod note on approval',
    helpText: 'Automatically add a mod note when approving users to track approval details',
    defaultValue: true
  }
];