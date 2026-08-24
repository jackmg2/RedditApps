import { Hono } from 'hono';
import { redis } from '@devvit/web/server';
import { createRemovalSync } from '../toolkit/removalSync';
import { isTracked, untrack } from '../toolkit/contentTracker';

const favoritesKey = (postId: string) => `favorite_notes_${postId}`;

// Rule 1: when a mod removes a MIDI post or a shared-composition comment the
// app created, delete it on our side too and drop its state.
const removalSync = createRemovalSync({
  isAppContent: (e) => isTracked(e.targetId),
  cleanup: async (e) => {
    if (e.kind === 'post') {
      await redis.del(favoritesKey(e.targetId));
    }
    await untrack(e.targetId);
  },
});

export const triggers = new Hono();

triggers.post('/on-mod-action', async (c) =>
  c.json(await removalSync.handleModAction(await c.req.json()), 200)
);

triggers.post('/on-post-delete', async (c) =>
  c.json(await removalSync.handlePostDelete(await c.req.json()), 200)
);

triggers.post('/on-comment-delete', async (c) =>
  c.json(await removalSync.handleCommentDelete(await c.req.json()), 200)
);
