import { Devvit } from '@devvit/public-api';
import { handleDeleteComment } from '../../handlers/commentHandlers.js';
import { formatCommentOption } from '../../utils/formatters.js';
import { Comment } from '../../types/index.js';

export const deleteCommentModal = Devvit.createForm((data) => ({
  title: "Delete comment template",
  fields: [
    {
      name: 'selectedTemplate',
      label: 'Select Template to Delete',
      type: 'select',
      options: [
        { label: 'Select a template...', value: '' },
        ...data.comments.map((c: Comment) => ({
          label: formatCommentOption(c),
          value: c.id
        }))
      ],
      multiSelect: false,
      required: true,
      helpText: 'Select the template you want to delete'
    }
  ],
  acceptLabel: 'Delete Template',
  cancelLabel: 'Cancel'
}), handleDeleteComment);