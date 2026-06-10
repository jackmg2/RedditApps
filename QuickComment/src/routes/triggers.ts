import { Hono } from 'hono';
import { reddit } from '@devvit/web/server';
import type { OnAppInstallRequest, OnPostSubmitRequest, TriggerResponse } from '@devvit/web/shared';
import type { T3 } from '@devvit/shared-types/tid.js';
import { CommentSelector } from '../utils/commentSelector.js';

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  const input = await c.req.json<OnAppInstallRequest>();
  console.log('App installed to subreddit: r/' + input.subreddit?.name);
  return c.json<TriggerResponse>({ status: 'success' }, 200);
});

triggers.post('/on-post-submit', async (c) => {
  try {
    const input = await c.req.json<OnPostSubmitRequest>();

    const postAuthor = input.author?.name;
    const flairTemplateId = input.post?.linkFlair?.templateId;
    const postId = input.post?.id as T3 | undefined;

    if (!postId) {
      console.error('on-post-submit: missing post ID');
      return c.json<TriggerResponse>({ status: 'success' }, 200);
    }

    const selector = new CommentSelector();
    const { commentText, shouldPin } = await selector.selectComment(postAuthor, flairTemplateId);

    if (commentText) {
      const comment = await reddit.submitComment({ id: postId, text: commentText });
      if (shouldPin) {
        await comment.distinguish(true);
      }
    }
  } catch (error) {
    console.error('on-post-submit error:', error);
  }

  return c.json<TriggerResponse>({ status: 'success' }, 200);
});
