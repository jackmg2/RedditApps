import { Devvit } from '@devvit/public-api';
import { handleDeleteUserComment } from '../../handlers/userHandlers.js';
import { formatUserCommentOption } from '../../utils/formatters.js';
import { UserComment } from '../../types/index.js';

export const deleteUserCommentModal = Devvit.createForm((data) => ({
  title: "Delete user comment template",
  fields: [
    {
      name: 'selectedTemplate',
      label: 'Select User Template to Delete',
      type: 'select',
      options: [
        { label: 'Select a user template...', value: '' },
        ...data.userComments.map((c: UserComment) => ({
          label: formatUserCommentOption(c),
          value: c.id
        }))
      ],
      multiSelect: false,
      required: true,
      helpText: 'Select the user template you want to delete'
    }
  ],
  acceptLabel: 'Delete User Template',
  cancelLabel: 'Cancel'
}), handleDeleteUserComment);