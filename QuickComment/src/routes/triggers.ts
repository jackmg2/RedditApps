import { Hono } from 'hono';
import { reddit } from '@devvit/web/server';
import type { OnAppInstallRequest, OnPostSubmitRequest, TriggerResponse } from '@devvit/web/shared';
import type { T3 } from '@devvit/shared-types/tid.js';
import { CommentSelector } from '../utils/commentSelector.js';
import { createRemovalSync } from '../toolkit/removalSync.js';
import {
  commentsUnderPost,
  isTracked,
  pruneOlderThan,
  trackComment,
  untrack,
} from '../toolkit/contentTracker.js';

export const triggers = new Hono();

// Rule 1: when a mod removes one of our auto/quick comments, delete it on our
// side too and drop it from the registry. commentsUnderPost additionally
// self-deletes our comment when the post's author deletes their post.
const removalSync = createRemovalSync({
  isAppContent: (e) => isTracked(e.targetId),
  cleanup: (e) => untrack(e.targetId),
  commentsUnderPost: (postId) => commentsUnderPost(postId),
});

triggers.post('/on-mod-action', async (c) =>
  c.json<TriggerResponse>(await removalSync.handleModAction(await c.req.json()), 200)
);

triggers.post('/on-comment-delete', async (c) =>
  c.json<TriggerResponse>(await removalSync.handleCommentDelete(await c.req.json()), 200)
);

triggers.post('/on-post-delete', async (c) =>
  c.json<TriggerResponse>(await removalSync.handlePostDelete(await c.req.json()), 200)
);

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
      await trackComment(comment.id, postId);
      if (shouldPin) {
        await comment.distinguish(true);
      }
      // Registry hygiene: this app comments on every matching post.
      void pruneOlderThan('comment', 180).catch(() => {});
    }
  } catch (error) {
    console.error('on-post-submit error:', error);
  }

  return c.json<TriggerResponse>({ status: 'success' }, 200);
});
