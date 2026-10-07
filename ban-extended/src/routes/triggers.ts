import { Hono } from 'hono';
import type {
  OnAppInstallRequest,
  OnCommentSubmitRequest,
  OnPostSubmitRequest,
  TriggerResponse,
} from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import type { T1, T3 } from '@devvit/shared-types/tid.js';
import { enforceShadowban } from '../core/shadowbanService.js';

export const triggers = new Hono();

const success: TriggerResponse = { status: 'success' };

triggers.post('/on-app-install', async (c) => {
  const input = await c.req.json<OnAppInstallRequest>();
  console.log('App installed to subreddit: r/' + input.subreddit?.name);

  return c.json<TriggerResponse>(success, 200);
});

// Shadowban enforcement: remove anything a shadowbanned user submits.
// Failures are logged, never thrown, so one bad event doesn't break the trigger.
async function enforceOnSubmit(kind: 'post' | 'comment', targetId: string | undefined, username: string | undefined, subredditName: string | undefined): Promise<void> {
  if (!targetId || !username) return;
  const subreddit = subredditName ?? context.subredditName;
  if (!subreddit) return;

  try {
    const removed = await enforceShadowban(subreddit, username, targetId as T1 | T3);
    if (removed) {
      console.log(`Shadowban: removed ${kind} ${targetId} by u/${username} in r/${subreddit}`);
    }
  } catch (error) {
    console.error(`Shadowban: failed to process ${kind} ${targetId} by u/${username}: ${error}`);
  }
}

triggers.post('/on-post-submit', async (c) => {
  const event = await c.req.json<OnPostSubmitRequest>();
  await enforceOnSubmit('post', event.post?.id, event.author?.name, event.subreddit?.name);
  return c.json<TriggerResponse>(success, 200);
});

triggers.post('/on-comment-submit', async (c) => {
  const event = await c.req.json<OnCommentSubmitRequest>();
  await enforceOnSubmit('comment', event.comment?.id, event.author?.name, event.subreddit?.name);
  return c.json<TriggerResponse>(success, 200);
});
