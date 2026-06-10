import { Hono } from 'hono';
import { context } from '@devvit/web/server';
import { settings } from '@devvit/web/server';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import type { FormField } from '@devvit/shared-types/shared/form.js';
import { CommentStorage } from '../storage/index.js';
import { getSubredditFlairs } from '../utils/reddit.js';
import { formatUnifiedCommentOption } from '../utils/formatters.js';

export const menu = new Hono();

// POST on a post — show all templates and let mod pick one to post
menu.post('/post-comment', async (c) => {
  const request = await c.req.json<MenuItemRequest>();
  const postId = request.targetId;

  try {
    const [comments, userComments, defaultPin] = await Promise.all([
      CommentStorage.getComments(),
      CommentStorage.getUserComments(),
      settings.get<boolean>('defaultValuePinComment'),
    ]);

    const allOptions = [
      ...comments.map((t) => ({ label: `[Flair] ${t.title}`, value: t.comment })),
      ...userComments.map((t) => ({ label: `[User] ${t.title} (u/${t.username})`, value: t.comment })),
    ];

    if (allOptions.length === 0) {
      return c.json<UiResponse>(
        { showToast: 'No comment templates found. Create one first.' },
        200
      );
    }

    const fields: FormField[] = [
      {
        name: 'postId',
        label: 'Post ID',
        type: 'string',
        disabled: true,
        defaultValue: postId,
      },
      {
        name: 'selectedComment',
        label: 'Comment Template',
        type: 'select',
        options: allOptions,
        required: true,
      },
      {
        name: 'isSticky',
        label: 'Sticky comment',
        type: 'boolean',
        defaultValue: defaultPin ?? false,
      },
    ];

    return c.json<UiResponse>(
      {
        showForm: {
          name: 'postComment',
          form: { title: 'Post Predefined Comment', fields, acceptLabel: 'Post Comment', cancelLabel: 'Cancel' },
        },
      },
      200
    );
  } catch (error) {
    console.error('post-comment menu error:', error);
    return c.json<UiResponse>({ showToast: 'An error occurred. Please try again.' }, 200);
  }
});

// Subreddit — unified template management hub
menu.post('/manage-templates', async (c) => {
  try {
    const [comments, userComments] = await Promise.all([
      CommentStorage.getComments(),
      CommentStorage.getUserComments(),
    ]);

    const hasTemplates = comments.length > 0 || userComments.length > 0;

    const actionOptions = [
      { label: 'Create new comment', value: 'create' },
      ...(hasTemplates ? [{ label: 'Edit existing one', value: 'edit' }] : []),
      ...(hasTemplates ? [{ label: 'Remove existing one', value: 'delete' }] : []),
    ];

    const fields: FormField[] = [
      {
        name: 'action',
        label: 'Action',
        type: 'select',
        options: actionOptions,
        required: true,
        helpText: 'Choose what you want to do.',
      },
    ];

    return c.json<UiResponse>(
      {
        showForm: {
          name: 'manageTemplates',
          form: { title: 'Manage Comment Templates', fields, acceptLabel: 'Continue →', cancelLabel: 'Cancel' },
        },
      },
      200
    );
  } catch (error) {
    console.error('manage-templates menu error:', error);
    return c.json<UiResponse>({ showToast: 'An error occurred. Please try again.' }, 200);
  }
});
