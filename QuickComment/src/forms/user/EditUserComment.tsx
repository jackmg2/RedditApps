import { Devvit } from '@devvit/public-api';
import { handleEditUserComment } from '../../handlers/userHandlers.js';
import { formatUserCommentOption } from '../../utils/formatters.js';
import { UserComment } from '../../types/index.js';

export const editUserCommentModal = Devvit.createForm((data) => ({
  title: "Edit user comment template",
  fields: [
    {
      name: 'selectedTemplate',
      label: 'Select User Template to Edit',
      type: 'select',
      options: [
        { label: 'Select a user template...', value: '' },
        ...data.userComments.map((c: UserComment) => ({
          label: formatUserCommentOption(c),
          value: c.id
        }))
      ],
      multiSelect: false,
      helpText: 'Select a user template to edit. Open View All Templates to see all original text.',
    },
    {
      name: 'title',
      label: 'Template Title',
      type: 'string',
      required: true,
      helpText: 'A short name for this user comment template.'
    },
    {
      name: 'username',
      label: 'Username',
      type: 'string',
      required: true,
      helpText: 'Username (with or without u/ prefix)'
    },
    {
      name: 'comment',
      label: 'Comment Text',
      type: 'paragraph',
      required: true,
      helpText: 'The comment text to post when this user creates a post.'
    },
    {
      name: 'pinnedByDefault',
      label: 'Pinned by default',
      type: 'boolean',
      defaultValue: false,
      helpText: 'If enabled, this comment will be automatically pinned when posted'
    }
  ],
  acceptLabel: 'Update User Template',
  cancelLabel: 'Cancel'
}), handleEditUserComment);