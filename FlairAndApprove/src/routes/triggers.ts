import { Hono } from 'hono';
import type { OnAppInstallRequest, TriggerResponse } from '@devvit/web/shared';
import { createRemovalSync } from '../toolkit/removalSync.js';
import { isTracked, untrack } from '../toolkit/contentTracker.js';

export const triggers = new Hono();

// Rule 1: when a mod removes one of our welcome comments, delete it on our
// side too and drop it from the registry.
const removalSync = createRemovalSync({
  isAppContent: (e) => isTracked(e.targetId),
  cleanup: (e) => untrack(e.targetId),
});

triggers.post('/on-mod-action', async (c) =>
  c.json<TriggerResponse>(await removalSync.handleModAction(await c.req.json()), 200)
);

triggers.post('/on-comment-delete', async (c) =>
  c.json<TriggerResponse>(await removalSync.handleCommentDelete(await c.req.json()), 200)
);

triggers.post('/on-app-install', async (c) => {
  const input = await c.req.json<OnAppInstallRequest>();
  console.log('App installed to subreddit: r/' + input.subreddit?.name);

  return c.json<TriggerResponse>(
    {
      status: 'success',
    },
    200
  );
});
