import { Hono } from 'hono';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import type { Form } from '@devvit/shared-types/shared/form.js';
import { reddit } from '@devvit/web/server';
import { T3 } from '@devvit/shared-types/tid.js';
import { getAppSettings } from '../config/appSettings';
import { RatioService } from '../services/ratioService';
import { FlairService } from '../services/flairService';
import { WikiService } from '../services/wikiService';

export const menu = new Hono();

menu.post('/manual-ratio', async (c) => {
  const request = await c.req.json<MenuItemRequest>();
  const post = await reddit.getPostById(T3(request.targetId));
  const userId = post.authorId;

  if (!userId) {
    return c.json<UiResponse>(
      { showToast: 'Error: Could not find post author' },
      200
    );
  }

  const [regularPosts, monitoredPosts] =
    await RatioService.getUserRatio(userId);
  const user = await reddit.getUserById(userId);

  if (!user) {
    return c.json<UiResponse>({ showToast: 'Error: Could not find user' }, 200);
  }

  const form: Form = {
    title: 'Manually modify ratio',
    fields: [
      {
        name: 'userId',
        label: 'User Id',
        type: 'string',
        disabled: true,
        defaultValue: user.id,
      },
      {
        name: 'regularCount',
        label: 'Usual Posts',
        type: 'number',
        disabled: false,
        defaultValue: regularPosts,
      },
      {
        name: 'monitoredCount',
        label: 'Monitored Flair',
        type: 'number',
        disabled: false,
        defaultValue: monitoredPosts,
      },
    ],
    acceptLabel: 'Submit',
    cancelLabel: 'Cancel',
  };

  return c.json<UiResponse>({ showForm: { name: 'manualRatio', form } }, 200);
});

menu.post('/change-flair', async (c) => {
  try {
    const request = await c.req.json<MenuItemRequest>();
    const postId = request.targetId;

    if (!postId) {
      return c.json<UiResponse>({ showToast: 'Error: No post ID found' }, 200);
    }

    const post = await reddit.getPostById(T3(postId));

    if (!post) {
      return c.json<UiResponse>(
        { showToast: 'Error: Could not find post' },
        200
      );
    }

    const userId = post.authorId;
    const user = userId ? await reddit.getUserById(userId) : undefined;

    if (!user) {
      return c.json<UiResponse>(
        { showToast: 'Error: Could not find user' },
        200
      );
    }

    const settings = await getAppSettings();
    const possibleFlairs = settings.monitoredFlair
      .split(';')
      .map((flair) => flair.trim())
      .filter((flair) => flair.length > 0)
      .map((flair) => ({ label: flair, value: flair }));

    possibleFlairs.push({ label: 'No flair', value: '' });

    const currentFlairText = post.flair?.text || 'No flair';

    console.log(
      `Opening change flair modal for user ${user.username}, post ${postId}, current flair: "${currentFlairText}"`
    );

    const form: Form = {
      title: `Manually modify ratio for ${user.username}`,
      fields: [
        {
          name: 'postId',
          label: 'Post Id',
          type: 'string',
          disabled: true,
          defaultValue: postId,
        },
        {
          name: 'userId',
          label: 'User Id',
          type: 'string',
          disabled: true,
          defaultValue: user.id,
        },
        {
          name: 'currentPostFlair',
          label: 'Current Post Flair',
          type: 'string',
          disabled: true,
          defaultValue: currentFlairText,
        },
        {
          name: 'newPostFlair',
          label: 'New Flair',
          type: 'select',
          disabled: false,
          options: possibleFlairs,
          multiSelect: false,
        },
      ],
      acceptLabel: 'Submit',
      cancelLabel: 'Cancel',
    };

    return c.json<UiResponse>({ showForm: { name: 'changeFlair', form } }, 200);
  } catch (error) {
    console.error(`Error in change-flair menu handler: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      200
    );
  }
});

menu.post('/remove-flair', async (c) => {
  const request = await c.req.json<MenuItemRequest>();
  const post = await reddit.getPostById(T3(request.targetId));
  const userId = post.authorId;
  const currentPostFlair = post.flair?.text;

  if (!userId) {
    return c.json<UiResponse>(
      { showToast: 'Error: Could not find post author' },
      200
    );
  }

  // Only proceed if the post has a flair
  if (!currentPostFlair) {
    return c.json<UiResponse>(
      { showToast: 'This post does not have a flair to remove.' },
      200
    );
  }

  // Use the flair service to update flair and ratio
  const result = await FlairService.updateFlairAndRatio(
    userId,
    currentPostFlair,
    '',
    post.id
  );

  return c.json<UiResponse>({ showToast: result.message }, 200);
});

menu.post('/set-ratio-by-username', async (c) => {
  const form: Form = {
    title: 'Set ratio by username',
    fields: [
      {
        name: 'username',
        label: 'Username',
        type: 'string',
        required: true,
      },
      {
        name: 'regularCount',
        label: 'Regular Posts',
        type: 'number',
        defaultValue: 0,
        required: true,
      },
      {
        name: 'monitoredCount',
        label: 'Monitored Posts',
        type: 'number',
        defaultValue: 1,
        required: true,
      },
    ],
    acceptLabel: 'Set Ratio',
    cancelLabel: 'Cancel',
  };

  return c.json<UiResponse>(
    { showForm: { name: 'setRatioByUsername', form } },
    200
  );
});

menu.post('/refresh-wiki', async (c) => {
  try {
    const eventCount = await WikiService.refreshWiki();

    if (eventCount === 0) {
      return c.json<UiResponse>(
        { showToast: 'No post records found to update wiki.' },
        200
      );
    }

    return c.json<UiResponse>(
      { showToast: 'RedditRatio wiki page updated successfully.' },
      200
    );
  } catch (error) {
    if (error instanceof Error) {
      return c.json<UiResponse>(
        { showToast: `Error updating wiki: ${error.message}` },
        200
      );
    }
    return c.json<UiResponse>(
      { showToast: 'An unknown error occurred while updating the wiki.' },
      200
    );
  }
});
