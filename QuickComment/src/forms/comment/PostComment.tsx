import { Devvit } from '@devvit/public-api';
import { handlePostComment } from '../../handlers/commentHandlers.js';

export const postCommentModal = Devvit.createForm((data) => ({
  title: "Add existing comment",
  fields: [
    {
      name: 'postId',
      label: 'Post Id',
      type: 'string',
      disabled: true,
      defaultValue: data.postId
    },
    {
      name: 'selectedComment',
      type: 'select',
      label: 'Comment',
      options: data.predefinedComments,
      multiSelect: false,
      required: true
    },
    {
      name: 'isSticky',
      type: 'boolean',
      label: 'Sticky comment',
      defaultValue: data.defaultValuePinComment
    },
  ],
  acceptLabel: 'Add comment',
  cancelLabel: 'Cancel'
}), handlePostComment);