import { Devvit } from '@devvit/public-api';
import { handleViewAllComments } from '../handlers/index.js';

export const viewAllCommentsModal = Devvit.createForm((data) => ({
  title: "View All Comment Templates",
  fields: [
    {
      name: 'allComments',
      label: 'All Comment Templates',
      type: 'paragraph',
      lineHeight: 20,
      defaultValue: data.formattedComments,
      disabled: false,
      helpText: 'This is a read-only view of all your comment templates.'
    }
  ],
  acceptLabel: 'Close but blue',
  cancelLabel: 'Close'
}), handleViewAllComments);