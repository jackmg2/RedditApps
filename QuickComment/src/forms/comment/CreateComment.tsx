import { Devvit } from '@devvit/public-api';
import { handleCreateUserComment } from '../../handlers/userHandlers.js';

export const createUserCommentModal = Devvit.createForm(() => ({
  title: "Create user-based comment template",
  fields: [
    {
      name: 'title',
      label: 'Template Title',
      type: 'string',
      required: true,
      helpText: 'A short name for this user comment template'
    },
    {
      name: 'username',
      label: 'Username',
      type: 'string',
      required: true,
      helpText: 'Username (with or without u/ prefix, e.g., "alice" or "u/alice"). You can create multiple different comment templates for the same user.'
    },
    {
      name: 'comment',
      label: 'Comment Text',
      type: 'paragraph',
      required: true,
      helpText: 'The comment text to post when this user creates a post. If multiple templates exist for the same user, one will be randomly selected.'
    },
    {
      name: 'pinnedByDefault',
      label: 'Pinned by default',
      type: 'boolean',
      defaultValue: false,
      helpText: 'If enabled, this comment will be automatically pinned when posted'
    }
  ],
  acceptLabel: 'Create User Template',
  cancelLabel: 'Cancel'
}), handleCreateUserComment);