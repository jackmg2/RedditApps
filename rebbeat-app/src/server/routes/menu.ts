import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { hasActiveStep, parseBeatCode } from '../../shared/beat';
import { setDefaultBeat } from '../core/defaultBeat';
import { createPost } from '../core/post';
import { buildTitlePromptForm, extractTitle } from '../toolkit/postCreation';

export const menu = new Hono();

const DEFAULT_POST_TITLE = 'Rebbeat — make a beat!';
const BEAT_CODE_FIELD = 'beatCode';

// Same payload shapes extractTitle accepts: { f } | { values: { f } }.
const extractField = (body: unknown, name: string): string => {
  const b = body as
    | { [k: string]: unknown; values?: Record<string, unknown> }
    | null
    | undefined;
  const value = b?.[name] ?? b?.values?.[name];
  return typeof value === 'string' ? value.trim() : '';
};

// Rule 3: the moderator is always asked for a title before the post exists.
menu.post('/post-create', (c) =>
  c.json(
    buildTitlePromptForm({
      formName: 'create-post',
      formTitle: 'Create a Rebbeat post',
      defaultTitle: DEFAULT_POST_TITLE,
      acceptLabel: 'Create post',
      extraFields: [
        {
          type: 'paragraph',
          name: BEAT_CODE_FIELD,
          label: 'Starting beat code (optional)',
          helpText:
            'Paste a beat code to show it when members open the post. Leave empty for the demo beat. You can also set it later from the post with "Set as default beat".',
          required: false,
        },
      ],
    }),
    200
  )
);

menu.post('/post-create-submit', async (c) => {
  try {
    const body: unknown = await c.req.json();
    const title = extractTitle(body, DEFAULT_POST_TITLE);

    // Validate before creating anything so a typo doesn't leave a post behind.
    const code = extractField(body, BEAT_CODE_FIELD);
    const beat = code ? parseBeatCode(code) : null;
    if (code && (!beat || !hasActiveStep(beat))) {
      return c.json<UiResponse>(
        {
          showToast:
            "That starting beat code isn't valid. Leave it empty or paste a code with a few hits.",
        },
        200
      );
    }

    const post = await createPost(title);
    if (beat) {
      try {
        await setDefaultBeat(post.id, beat);
      } catch (error) {
        // The post is up with the demo beat; the default can be set in-app.
        console.error(`Error saving starting beat: ${error}`);
      }
    }

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
