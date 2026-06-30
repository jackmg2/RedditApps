import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createPost } from '../core/post';

export const menu = new Hono();

const DEFAULT_POST_TITLE = 'MIDI Mini Music';

menu.post('/post-create', (c) => {
  return c.json<UiResponse>(
    {
      showForm: {
        name: 'create-post',
        form: {
          title: 'Create MIDI Mini Music post',
          acceptLabel: 'Create post',
          fields: [
            {
              type: 'string',
              name: 'title',
              label: 'Post title',
              required: true,
              defaultValue: DEFAULT_POST_TITLE,
            },
          ],
        },
      },
    },
    200
  );
});

menu.post('/post-create-submit', async (c) => {
  try {
    const body = await c.req.json<{ title?: string; values?: { title?: string } }>();
    const rawTitle = body.values?.title ?? body.title;
    const title = rawTitle?.trim() || DEFAULT_POST_TITLE;
    const post = await createPost(title);

    return c.json<UiResponse>(
      {
        navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
      },
      200
    );
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: 'Failed to create post',
      },
      400
    );
  }
});
