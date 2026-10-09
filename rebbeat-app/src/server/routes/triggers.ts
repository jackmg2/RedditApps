import { Hono } from 'hono';
import { createRemovalSync } from '../toolkit/removalSync';
import { isTracked, untrack } from '../toolkit/contentTracker';
import { deleteAppCommentsUnderPost } from '../core/appComments';
import { clearDefaultBeat } from '../core/defaultBeat';
import { ensurePostDeleted } from '../core/post';
import { forgetSharedPost } from '../core/sharedBeats';

// Rule 1: when a mod removes a Rebbeat post the app created, delete it on our
// side too, along with any comments the app account wrote under it, and drop
// its state. Shared-beat comments are posted as the member (runAs: 'USER'),
// so they are the member's content, not the app's: no removal sync for
// comment actions.
const removalSync = createRemovalSync({
  isAppContent: (e) => isTracked(e.targetId),
  cleanup: async (e) => {
    console.log(`Removal sync (${e.source}) for ${e.targetId}`);
    let postGone = true;
    if (e.source === 'modAction') {
      try {
        await ensurePostDeleted(e.targetId);
      } catch (error) {
        console.error(`Error deleting removed post ${e.targetId}:`, error);
        postGone = false;
      }
    }
    try {
      await deleteAppCommentsUnderPost(e.targetId);
    } catch (error) {
      console.error(`Error deleting app comments under ${e.targetId}:`, error);
    }
    // Keep the post tracked while it still exists, so the next removal (or
    // the upgrade sweep) retries instead of no longer recognizing it.
    if (!postGone) return;
    await forgetSharedPost(e.targetId);
    await clearDefaultBeat(e.targetId);
    await untrack(e.targetId);
  },
  commentActions: [],
});

export const triggers = new Hono();

triggers.post('/on-mod-action', async (c) =>
  c.json(await removalSync.handleModAction(await c.req.json()), 200)
);

triggers.post('/on-post-delete', async (c) =>
  c.json(await removalSync.handlePostDelete(await c.req.json()), 200)
);

// Catches app posts a mod removed while the live trigger was missing or
// failed: sweeps the app account's own posts, so it needs no tracking state.
triggers.post('/on-app-upgrade', async (c) =>
  c.json(await removalSync.sweepRemovedAppPosts(), 200)
);
