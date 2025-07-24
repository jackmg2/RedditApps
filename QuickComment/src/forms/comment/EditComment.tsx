import { Devvit } from '@devvit/public-api';
import { handleEditComment } from '../../handlers/commentHandlers.js';
import { formatCommentOption } from '../../utils/formatters.js';
import { Comment } from '../../types/index.js';

export const editCommentModal = Devvit.createForm((data) => ({
  title: "Edit comment template",
  fields: [
    {
      name: 'selectedTemplate',
      label: 'Select Template to Edit',
      type: 'select',
      options: [
        { label: 'Select a template...', value: '' },
        ...data.comments.map((c: Comment) => ({
          label: formatCommentOption(c),
          value: c.id
        }))
      ],
      multiSelect: false,
      helpText: 'Select a template to edit. Open View All Templates to see all original text.',
    },
    {
      name: 'title',
      label: 'Template Title',
      type: 'string',
      required: true,
      helpText: 'A short name for this comment template.'
    },
    {
      name: 'comment',
      label: 'Comment Text',
      type: 'paragraph',
      required: true,
      helpText: 'The comment text.'
    },
    {
      name: 'selectedFlairs',
      label: 'Associated Post Flairs (Optional)',
      type: 'select',
      options: data.flairs,
      multiSelect: true,
      helpText: 'Select flairs that should trigger this comment automatically.'
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
  acceptLabel: 'Update Template',
  cancelLabel: 'Cancel'
}), handleEditComment);