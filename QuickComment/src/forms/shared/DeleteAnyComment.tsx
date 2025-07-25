// This file should be created at: QuickComment/src/forms/unified/DeleteAnyComment.tsx

import { Devvit } from '@devvit/public-api';
import { handleDeleteAnyComment } from '../../handlers/sharedHandlers.js';
import { formatUnifiedCommentOption } from '../../utils/formatters.js';
import { Comment, UserComment } from '../../types/index.js';

export const deleteAnyCommentModal = Devvit.createForm((data) => {
  // Combine both comment types into a single array with type indicators
  const allTemplates = [
    ...data.comments.map((c: Comment) => ({
      label: formatUnifiedCommentOption(c, 'flair'),
      value: `flair:${c.id}`
    })),
    ...data.userComments.map((c: UserComment) => ({
      label: formatUnifiedCommentOption(c, 'user'),
      value: `user:${c.id}`
    }))
  ];

  return {
    title: "Delete comment template",
    fields: [
      {
        name: 'selectedTemplate',
        label: 'Select Template to Delete',
        type: 'select',
        options: [
          { label: 'Select a template...', value: '' },
          ...allTemplates
        ],
        multiSelect: false,
        required: true,
        helpText: 'Select any comment template (user-based or flair-based) to delete'
      }
    ],
    acceptLabel: 'Delete Template',
    cancelLabel: 'Cancel'
  };
}, handleDeleteAnyComment);