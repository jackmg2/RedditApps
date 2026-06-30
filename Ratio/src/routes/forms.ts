import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context, reddit } from '@devvit/web/server';
import { T2, T3 } from '@devvit/shared-types/tid.js';
import { RatioService } from '../services/ratioService';
import { FlairService } from '../services/flairService';
import { WikiService } from '../services/wikiService';

type ManualRatioFormValues = {
  userId?: string;
  regularCount?: number;
  monitoredCount?: number;
};

type ChangeFlairFormValues = {
  postId?: string;
  userId?: string;
  currentPostFlair?: string;
  newPostFlair?: string[];
};

type SetRatioByUsernameFormValues = {
  username?: string;
  regularCount?: number;
  monitoredCount?: number;
};

export const forms = new Hono();

forms.post('/manual-ratio-submit', async (c) => {
  const values = await c.req.json<ManualRatioFormValues>();
  const userId = String(values.userId);
  const regularCount = Number(values.regularCount);
  const monitoredCount = Number(values.monitoredCount);

  try {
    await RatioService.updateUserRatio(regularCount, monitoredCount, userId);

    // Audit trail for the wiki
    const user = await reddit.getUserById(T2(userId));
    await WikiService.recordPost({
      authorName: user?.username ?? userId,
      date: new Date().toISOString().split('T')[0]!,
      postTitle: '[MANUAL ADJUSTMENT]',
      postLink: `https://www.reddit.com/r/${context.subredditName}`,
      ratio: `${regularCount}/${monitoredCount}`,
    });

    return c.json<UiResponse>(
      { showToast: 'User ratio modified, please refresh.' },
      200
    );
  } catch (error) {
    if (error instanceof Error) {
      return c.json<UiResponse>(
        { showToast: `An error occurred: ${error.message}` },
        200
      );
    }
    return c.json<UiResponse>(
      { showToast: 'An unknown error occurred while updating the ratio.' },
      200
    );
  }
});

forms.post('/change-flair-submit', async (c) => {
  try {
    const values = await c.req.json<ChangeFlairFormValues>();
    const { currentPostFlair, newPostFlair } = values;

    // Fall back to the request context if the disabled carrier fields
    // did not round-trip with the submission.
    const postId = values.postId || context.postId;
    let userId = values.userId;
    if (!userId && postId) {
      const post = await reddit.getPostById(T3(postId));
      userId = post.authorId;
    }

    if (!userId || !postId) {
      return c.json<UiResponse>(
        { showToast: 'Missing required data (userId or postId)' },
        200
      );
    }

    const selectedPostFlair =
      newPostFlair !== undefined && newPostFlair.length > 0
        ? newPostFlair[0]!
        : '';

    console.log(
      `Form submission - UserID: ${userId}, PostID: ${postId}, Current: "${currentPostFlair}", New: "${selectedPostFlair}"`
    );

    const result = await FlairService.updateFlairAndRatio(
      userId,
      currentPostFlair ?? '',
      selectedPostFlair,
      postId
    );

    return c.json<UiResponse>({ showToast: result.message }, 200);
  } catch (error) {
    console.error(`Error in form handler: ${error}`);
    return c.json<UiResponse>(
      {
        showToast: `Error processing form: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      200
    );
  }
});

forms.post('/set-ratio-by-username-submit', async (c) => {
  const values = await c.req.json<SetRatioByUsernameFormValues>();
  const { username, regularCount, monitoredCount } = values;

  try {
    // Convert string username to user ID
    const user = username
      ? await reddit.getUserByUsername(username)
      : undefined;

    if (!user) {
      return c.json<UiResponse>(
        { showToast: `User ${username} not found.` },
        200
      );
    }

    // Update the user's ratio
    await RatioService.updateUserRatio(
      Number(regularCount),
      Number(monitoredCount),
      user.id
    );

    // Add a record to the wiki ([regular/monitored], consistent with the
    // convention used everywhere else)
    const newRatio = `${Number(regularCount)}/${Number(monitoredCount)}`;
    await WikiService.recordPost({
      authorName: username!,
      date: new Date().toISOString().split('T')[0]!,
      postTitle: '[MANUAL ADJUSTMENT]',
      postLink: `https://www.reddit.com/r/${context.subredditName}`,
      ratio: newRatio,
    });

    return c.json<UiResponse>(
      { showToast: `Ratio for ${username} has been set to ${newRatio}.` },
      200
    );
  } catch (error) {
    if (error instanceof Error) {
      return c.json<UiResponse>(
        { showToast: `An error occurred: ${error.message}` },
        200
      );
    }
    return c.json<UiResponse>(
      { showToast: 'An unknown error occurred while setting the ratio.' },
      200
    );
  }
});
