import { Hono } from 'hono';
import { context } from '@devvit/web/server';
import type { UiResponse } from '@devvit/web/shared';
import type { FormField } from '@devvit/shared-types/shared/form.js';
import { CommentStorage } from '../storage/index.js';
import { postComment, getSubredditFlairs } from '../utils/reddit.js';
import { cleanUsername } from '../utils/validators.js';
import { formatUnifiedCommentOption } from '../utils/formatters.js';
import type { Comment, UserComment } from '../types/index.js';

export const forms = new Hono();

// ─── Post predefined comment on a post ───────────────────────────────────────

forms.post('/post-comment-submit', async (c) => {
  try {
    const values = await c.req.json<{
      postId?: string;
      selectedComment?: string[];
      isSticky?: boolean;
    }>();

    const postId = values.postId?.trim();
    const commentText = values.selectedComment?.[0];
    const isSticky = Boolean(values.isSticky);

    if (!postId || !commentText) {
      return c.json<UiResponse>({ showToast: 'Please select a comment template.' }, 200);
    }

    const message = await postComment(postId, commentText, isSticky);
    return c.json<UiResponse>({ showToast: message }, 200);
  } catch (error) {
    console.error('post-comment-submit error:', error);
    return c.json<UiResponse>({ showToast: 'Failed to post comment. Please try again.' }, 200);
  }
});

// ─── Hub: dispatch to create / edit / delete ─────────────────────────────────

forms.post('/manage-templates-submit', async (c) => {
  try {
    const values = await c.req.json<{ action?: string[] }>();
    const action = values.action?.[0];

    if (action === 'create') {
      const flairs = await getSubredditFlairs(context.subredditName);
      const flairOptions = flairs.map((f) => ({ label: f.text, value: f.id }));

      const fields: FormField[] = [
        { name: 'title', label: 'Template Title', type: 'string', required: true },
        { name: 'comment', label: 'Comment Text', type: 'paragraph', required: true },
        {
          name: 'selectedFlairs',
          label: 'Associated Post Flairs',
          type: 'select',
          options: flairOptions,
          multiSelect: true,
          helpText: 'Leave empty to post on all submissions, or enter a username above for user-specific matching.',
        },
        {
          name: 'username',
          label: 'Username',
          type: 'string',
          helpText: 'Leave empty to match all posts or specific flair.',
        },
        {
          name: 'pinnedByDefault',
          label: 'Pinned by default',
          type: 'boolean',
          defaultValue: false,
        },
      ];

      return c.json<UiResponse>(
        {
          showForm: {
            name: 'manageCreate',
            form: { title: 'Create Comment Template', fields, acceptLabel: 'Create Template', cancelLabel: 'Cancel' },
          },
        },
        200
      );
    }

    if (action === 'edit') {
      const [comments, userComments] = await Promise.all([
        CommentStorage.getComments(),
        CommentStorage.getUserComments(),
      ]);

      const allOptions = [
        { label: 'Select a template...', value: '' },
        ...comments.map((t) => ({ label: formatUnifiedCommentOption(t, 'flair'), value: `flair:${t.id}` })),
        ...userComments.map((t) => ({ label: formatUnifiedCommentOption(t, 'user'), value: `user:${t.id}` })),
      ];

      const fields: FormField[] = [
        {
          name: 'selectedTemplate',
          label: 'Select Template to Edit',
          type: 'select',
          options: allOptions,
          required: true,
        },
      ];

      return c.json<UiResponse>(
        {
          showForm: {
            name: 'manageSelectEdit',
            form: { title: 'Edit — Select Template', fields, acceptLabel: 'Next →', cancelLabel: 'Cancel' },
          },
        },
        200
      );
    }

    if (action === 'delete') {
      const [comments, userComments] = await Promise.all([
        CommentStorage.getComments(),
        CommentStorage.getUserComments(),
      ]);

      const allOptions = [
        ...comments.map((t) => ({ label: formatUnifiedCommentOption(t, 'flair'), value: `flair:${t.id}` })),
        ...userComments.map((t) => ({ label: formatUnifiedCommentOption(t, 'user'), value: `user:${t.id}` })),
      ];

      const fields: FormField[] = [
        {
          name: 'selectedTemplates',
          label: 'Select Templates to Delete',
          type: 'select',
          options: allOptions,
          multiSelect: true,
          required: true,
          helpText: 'Select one or more templates to delete.',
        },
      ];

      return c.json<UiResponse>(
        {
          showForm: {
            name: 'manageDelete',
            form: { title: 'Delete Comment Templates', fields, acceptLabel: 'Delete Selected', cancelLabel: 'Cancel' },
          },
        },
        200
      );
    }

    return c.json<UiResponse>({ showToast: 'Please select an action.' }, 200);
  } catch (error) {
    console.error('manage-templates-submit error:', error);
    return c.json<UiResponse>({ showToast: 'An error occurred. Please try again.' }, 200);
  }
});

// ─── Create: unified flair or user template ──────────────────────────────────

forms.post('/manage-create-submit', async (c) => {
  try {
    const values = await c.req.json<{
      title?: string;
      comment?: string;
      selectedFlairs?: string[];
      username?: string;
      pinnedByDefault?: boolean;
    }>();

    const title = values.title?.trim();
    const comment = values.comment?.trim();
    const username = cleanUsername(values.username ?? '');
    const selectedFlairs = Array.isArray(values.selectedFlairs) ? values.selectedFlairs : [];
    const type = username ? 'user' : 'flair';

    if (!title || !comment) {
      return c.json<UiResponse>({ showToast: 'Title and comment text are required.' }, 200);
    }

    if (username && selectedFlairs.length > 0) {
      return c.json<UiResponse>(
        { showToast: 'A template cannot have both a username and post flairs. Please use one or the other.' },
        200
      );
    }

    if (type === 'user') {
      const newUserComment: UserComment = {
        id: await CommentStorage.getNextUserId(),
        title,
        comment,
        username,
        pinnedByDefault: Boolean(values.pinnedByDefault),
      };

      const userComments = await CommentStorage.getUserComments();
      userComments.push(newUserComment);
      await CommentStorage.saveUserComments(userComments);

      return c.json<UiResponse>({ showToast: `User template "${title}" (u/${username}) created successfully!` }, 200);
    }

    // flair type
    const newComment: Comment = {
      id: await CommentStorage.getNextId(),
      title,
      comment,
      flairs: selectedFlairs,
      pinnedByDefault: Boolean(values.pinnedByDefault),
    };

    const comments = await CommentStorage.getComments();
    comments.push(newComment);
    await CommentStorage.saveComments(comments);

    return c.json<UiResponse>({ showToast: `Flair template "${title}" created successfully!` }, 200);
  } catch (error) {
    console.error('manage-create-submit error:', error);
    return c.json<UiResponse>({ showToast: 'Failed to create template. Please try again.' }, 200);
  }
});

// ─── Edit step 1: select template → return pre-populated edit form ───────────

forms.post('/manage-select-edit-submit', async (c) => {
  try {
    const values = await c.req.json<{ selectedTemplate?: string[] }>();
    const templateValue = values.selectedTemplate?.[0];

    if (!templateValue) {
      return c.json<UiResponse>({ showToast: 'Please select a template to edit.' }, 200);
    }

    const colonIdx = templateValue.indexOf(':');
    if (colonIdx === -1) {
      return c.json<UiResponse>({ showToast: 'Error: Invalid template selection.' }, 200);
    }

    const templateType = templateValue.slice(0, colonIdx);
    const templateId = templateValue.slice(colonIdx + 1);

    const flairs = await getSubredditFlairs(context.subredditName);
    const flairOptions = flairs.map((f) => ({ label: f.text, value: f.id }));

    let templateTitle: string;
    let prePopulatedComment: string;
    let prePopulatedFlairs: string[] = [];
    let prePopulatedUsername = '';
    let prePopulatedPinned = false;
    let prePopulatedEnabled = true;

    if (templateType === 'flair') {
      const template = await CommentStorage.findCommentById(templateId);
      if (!template) {
        return c.json<UiResponse>({ showToast: 'Error: Template not found.' }, 200);
      }
      templateTitle = template.title;
      prePopulatedComment = template.comment;
      prePopulatedFlairs = template.flairs;
      prePopulatedPinned = template.pinnedByDefault;
      prePopulatedEnabled = template.enabled !== false;
    } else if (templateType === 'user') {
      const template = await CommentStorage.findUserCommentById(templateId);
      if (!template) {
        return c.json<UiResponse>({ showToast: 'Error: User template not found.' }, 200);
      }
      templateTitle = template.title;
      prePopulatedComment = template.comment;
      prePopulatedUsername = template.username;
      prePopulatedPinned = template.pinnedByDefault;
      prePopulatedEnabled = template.enabled !== false;
    } else {
      return c.json<UiResponse>({ showToast: 'Error: Unknown template type.' }, 200);
    }

    const fields: FormField[] = [
      {
        name: 'templateRef',
        label: 'Template Reference',
        type: 'string',
        disabled: true,
        defaultValue: templateValue,
      },
      { name: 'title', label: 'Title', type: 'string', required: true, defaultValue: templateTitle },
      { name: 'comment', label: 'Comment Text', type: 'paragraph', required: true, defaultValue: prePopulatedComment },
      {
        name: 'selectedFlairs',
        label: 'Associated Post Flairs',
        type: 'select',
        options: flairOptions,
        multiSelect: true,
        defaultValue: prePopulatedFlairs,
        helpText: 'Leave empty to post on all submissions, or enter a username below for user-specific matching.',
      },
      {
        name: 'username',
        label: 'Username',
        type: 'string',
        defaultValue: prePopulatedUsername,
        helpText: 'Leave empty to match all posts or specific flair.',
      },
      { name: 'pinnedByDefault', label: 'Pinned by default', type: 'boolean', defaultValue: prePopulatedPinned },
      {
        name: 'enabled',
        label: 'Enabled',
        type: 'boolean',
        defaultValue: prePopulatedEnabled,
        helpText: 'When disabled, this template will not be posted automatically.',
      },
    ];

    return c.json<UiResponse>(
      {
        showForm: {
          name: 'manageEdit',
          form: { title: `Edit: "${templateTitle}"`, fields, acceptLabel: 'Save Changes', cancelLabel: 'Cancel' },
        },
      },
      200
    );

    return c.json<UiResponse>({ showToast: 'Error: Unknown template type.' }, 200);
  } catch (error) {
    console.error('manage-select-edit-submit error:', error);
    return c.json<UiResponse>({ showToast: 'An error occurred. Please try again.' }, 200);
  }
});

// ─── Edit step 2: save changes ────────────────────────────────────────────────

forms.post('/manage-edit-submit', async (c) => {
  try {
    const values = await c.req.json<{
      templateRef?: string;
      title?: string;
      comment?: string;
      selectedFlairs?: string[];
      username?: string;
      pinnedByDefault?: boolean;
      enabled?: boolean;
    }>();

    const templateRef = values.templateRef?.trim();
    const title = values.title?.trim();
    const comment = values.comment?.trim();

    if (!templateRef) {
      return c.json<UiResponse>({ showToast: 'Error: Missing template reference.' }, 200);
    }
    if (!title || !comment) {
      return c.json<UiResponse>({ showToast: 'Title and comment text are required.' }, 200);
    }

    const colonIdx = templateRef.indexOf(':');
    if (colonIdx === -1) {
      return c.json<UiResponse>({ showToast: 'Error: Invalid template reference.' }, 200);
    }

    const originalType = templateRef.slice(0, colonIdx);
    const templateId = templateRef.slice(colonIdx + 1);

    const username = cleanUsername(values.username ?? '');
    const selectedFlairs = Array.isArray(values.selectedFlairs) ? values.selectedFlairs : [];
    const pinnedByDefault = Boolean(values.pinnedByDefault);
    const enabled = values.enabled !== false;
    const newType = username ? 'user' : 'flair';

    if (username && selectedFlairs.length > 0) {
      return c.json<UiResponse>(
        { showToast: 'A template cannot have both a username and post flairs. Please use one or the other.' },
        200
      );
    }

    if (newType === 'flair' && originalType === 'flair') {
      const comments = await CommentStorage.getComments();
      const idx = comments.findIndex((t) => t.id === templateId);
      if (idx === -1) {
        return c.json<UiResponse>({ showToast: 'Error: Template not found.' }, 200);
      }

      comments[idx] = {
        id: templateId,
        title,
        comment,
        flairs: selectedFlairs,
        displayOnAllPosts: selectedFlairs.length === 0,
        pinnedByDefault,
        enabled,
      };

      await CommentStorage.saveComments(comments);
      return c.json<UiResponse>({ showToast: `Flair template "${title}" updated successfully!` }, 200);
    }

    if (newType === 'user' && originalType === 'user') {
      const userComments = await CommentStorage.getUserComments();
      const idx = userComments.findIndex((t) => t.id === templateId);
      if (idx === -1) {
        return c.json<UiResponse>({ showToast: 'Error: User template not found.' }, 200);
      }

      userComments[idx] = { id: templateId, title, comment, username, pinnedByDefault, enabled };
      await CommentStorage.saveUserComments(userComments);
      return c.json<UiResponse>({ showToast: `User template "${title}" updated successfully!` }, 200);
    }

    // Type changed — delete from old collection, create in new collection
    if (newType === 'user' && originalType === 'flair') {
      await CommentStorage.deleteComment(templateId);
      const newUserComment: UserComment = {
        id: await CommentStorage.getNextUserId(),
        title,
        comment,
        username,
        pinnedByDefault,
        enabled,
      };
      const userComments = await CommentStorage.getUserComments();
      userComments.push(newUserComment);
      await CommentStorage.saveUserComments(userComments);
      return c.json<UiResponse>({ showToast: `Template "${title}" converted to user type and saved.` }, 200);
    }

    if (newType === 'flair' && originalType === 'user') {
      await CommentStorage.deleteUserComment(templateId);
      const newComment: Comment = {
        id: await CommentStorage.getNextId(),
        title,
        comment,
        flairs: selectedFlairs,
        displayOnAllPosts: selectedFlairs.length === 0,
        pinnedByDefault,
        enabled,
      };
      const comments = await CommentStorage.getComments();
      comments.push(newComment);
      await CommentStorage.saveComments(comments);
      return c.json<UiResponse>({ showToast: `Template "${title}" converted to flair type and saved.` }, 200);
    }

    return c.json<UiResponse>({ showToast: 'Error: Unknown template type.' }, 200);
  } catch (error) {
    console.error('manage-edit-submit error:', error);
    return c.json<UiResponse>({ showToast: 'Failed to update template. Please try again.' }, 200);
  }
});

// ─── Delete: bulk delete selected templates ───────────────────────────────────

forms.post('/manage-delete-submit', async (c) => {
  try {
    const values = await c.req.json<{ selectedTemplates?: string[] }>();
    const selected = values.selectedTemplates;

    if (!selected || selected.length === 0) {
      return c.json<UiResponse>({ showToast: 'Please select at least one template to delete.' }, 200);
    }

    let deletedCount = 0;
    for (const templateValue of selected) {
      const colonIdx = templateValue.indexOf(':');
      if (colonIdx === -1) continue;

      const templateType = templateValue.slice(0, colonIdx);
      const templateId = templateValue.slice(colonIdx + 1);

      if (templateType === 'flair') {
        const deleted = await CommentStorage.deleteComment(templateId);
        if (deleted) deletedCount++;
      } else if (templateType === 'user') {
        const deleted = await CommentStorage.deleteUserComment(templateId);
        if (deleted) deletedCount++;
      }
    }

    if (deletedCount === 0) {
      return c.json<UiResponse>({ showToast: 'No templates were deleted. They may have already been removed.' }, 200);
    }

    return c.json<UiResponse>(
      { showToast: `Deleted ${deletedCount} template${deletedCount === 1 ? '' : 's'} successfully.` },
      200
    );
  } catch (error) {
    console.error('manage-delete-submit error:', error);
    return c.json<UiResponse>({ showToast: 'Failed to delete templates. Please try again.' }, 200);
  }
});
