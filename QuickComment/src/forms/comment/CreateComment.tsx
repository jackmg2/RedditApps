import { Devvit } from '@devvit/public-api';
import { handleCreateComment } from '../../handlers/commentHandlers.js';

export const createCommentModal = Devvit.createForm((data) => ({
  title: "Create new comment template",
  fields: [
    {
      name: 'title',
      label: 'Template Title',
      type: 'string',
      required: true,
      helpText: 'A short name for this comment template'
    },
    {
      name: 'comment',
      label: 'Comment Text',
      type: 'paragraph',
      required: true,
      helpText: 'The comment text'
    },
    {
      name: 'selectedFlairs',
      label: 'Associated Post Flairs (Optional)',
      type: 'select',
      options: data.flairs,
      multiSelect: true,
      helpText: 'Select flairs that should trigger this comment automatically'
    },
    {
      name: 'displayOnAllPosts',
      label: 'Display on all posts',
      type: 'boolean',
      defaultValue: false,
      helpText: 'If enabled, this comment will be automatically posted on every new post, regardless of flair'
    },
    {
      name: 'pinnedByDefault',
      label: 'Pinned by default',
      type: 'boolean',
      defaultValue: false,
      helpText: 'If enabled, this comment will be automatically pinned when posted'
    }
  ],
  acceptLabel: 'Create Template',
  cancelLabel: 'Cancel'
}), handleCreateComment);