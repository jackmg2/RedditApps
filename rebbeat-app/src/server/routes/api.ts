import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type {
  ApiErrorResponse,
  InitResponse,
  SetDefaultBeatRequest,
  SetDefaultBeatResponse,
  ShareBeatRequest,
  ShareBeatResponse,
} from '../../shared/api';
import {
  formatBeatCode,
  hasActiveStep,
  parseBeatCode,
} from '../../shared/beat';
import {
  clearDefaultBeat,
  getDefaultBeatCode,
  setDefaultBeat,
} from '../core/defaultBeat';
import { buildShareComment, sanitizeShareMessage } from '../core/shareComment';
import { recordSharedBeat } from '../core/sharedBeats';
import { checkModPermission } from '../toolkit/modPermissions';

// Changing what every member sees in the post is a content decision.
const DEFAULT_BEAT_PERMISSION = 'posts';

const SHARE_COOLDOWN_MS = 30_000;

const rateLimitKey = (postId: string, userId: string) =>
  `beat:ratelimit:${postId}:${userId}`;

export const api = new Hono();

api.get('/init', async (c) => {
  const { postId, userId } = context;

  if (!postId) {
    console.error('API Init Error: postId not found in devvit context');
    return c.json<ApiErrorResponse>(
      {
        status: 'error',
        message: 'postId is required but missing from context',
      },
      400
    );
  }

  const [defaultBeat, permission] = await Promise.all([
    getDefaultBeatCode(postId).catch((error: unknown) => {
      console.error('Error reading default beat:', error);
      return null;
    }),
    // Logged-out viewers can't be moderators: skip the lookup.
    userId ? checkModPermission([DEFAULT_BEAT_PERMISSION]) : null,
  ]);

  return c.json<InitResponse>({
    type: 'init',
    postId,
    canShare: Boolean(userId),
    canSetDefault: permission?.allowed ?? false,
    defaultBeat,
  });
});

api.post('/beat/default', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ApiErrorResponse>(
      { status: 'error', message: 'postId is required' },
      400
    );
  }

  // Rule 4: the menu item is hidden for non-mods, but the server decides.
  const permission = await checkModPermission([DEFAULT_BEAT_PERMISSION]);
  if (!permission.allowed) {
    return c.json<ApiErrorResponse>(
      {
        status: 'error',
        message: `Only moderators with the "${DEFAULT_BEAT_PERMISSION}" permission can change the default beat`,
      },
      403
    );
  }

  let body: Partial<SetDefaultBeatRequest>;
  try {
    body = await c.req.json<Partial<SetDefaultBeatRequest>>();
  } catch {
    return c.json<ApiErrorResponse>(
      { status: 'error', message: 'Invalid request body' },
      400
    );
  }

  try {
    if (body.code === null) {
      await clearDefaultBeat(postId);
      return c.json<SetDefaultBeatResponse>({
        type: 'defaultBeatSet',
        defaultBeat: null,
      });
    }

    const beat =
      typeof body.code === 'string' ? parseBeatCode(body.code) : null;
    if (!beat) {
      return c.json<ApiErrorResponse>(
        { status: 'error', message: "That doesn't look like a Rebbeat code" },
        400
      );
    }
    if (!hasActiveStep(beat)) {
      return c.json<ApiErrorResponse>(
        {
          status: 'error',
          message: 'Add a few hits before making this the default beat',
        },
        400
      );
    }

    return c.json<SetDefaultBeatResponse>({
      type: 'defaultBeatSet',
      defaultBeat: await setDefaultBeat(postId, beat),
    });
  } catch (error) {
    console.error('Error saving default beat:', error);
    return c.json<ApiErrorResponse>(
      { status: 'error', message: 'Failed to save the default beat' },
      400
    );
  }
});

api.post('/beat/share', async (c) => {
  const { postId, userId } = context;
  if (!postId) {
    return c.json<ApiErrorResponse>(
      { status: 'error', message: 'postId is required' },
      400
    );
  }
  if (!userId) {
    return c.json<ApiErrorResponse>(
      { status: 'error', message: 'You must be logged in to share a beat' },
      401
    );
  }

  let body: Partial<ShareBeatRequest>;
  try {
    body = await c.req.json<Partial<ShareBeatRequest>>();
  } catch {
    return c.json<ApiErrorResponse>(
      { status: 'error', message: 'Invalid request body' },
      400
    );
  }

  // Never trust the client's rendering of the code: parse it, then post our
  // own formatting of the parsed beat.
  const beat = typeof body.code === 'string' ? parseBeatCode(body.code) : null;
  if (!beat) {
    return c.json<ApiErrorResponse>(
      { status: 'error', message: "That doesn't look like a Rebbeat code" },
      400
    );
  }
  if (!hasActiveStep(beat)) {
    return c.json<ApiErrorResponse>(
      { status: 'error', message: 'Add a few hits before sharing your beat' },
      400
    );
  }

  const limitKey = rateLimitKey(postId, userId);
  if (await redis.get(limitKey)) {
    return c.json<ApiErrorResponse>(
      {
        status: 'error',
        message:
          'Easy there, drummer! Wait a few seconds before sharing again.',
      },
      429
    );
  }
  await redis.set(limitKey, '1', {
    expiration: new Date(Date.now() + SHARE_COOLDOWN_MS),
  });

  try {
    const message = sanitizeShareMessage(body.message);
    // Username appears only in the public comment, never in the app UI.
    const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
    const text = buildShareComment(beat, message, username);

    // Posted under the member's own account: the comment is theirs, not the
    // app's, so it is not tracked for removal sync.
    const comment = await reddit.submitComment({
      id: postId,
      text,
      runAs: 'USER',
    });

    try {
      await recordSharedBeat(postId, {
        commentId: comment.id,
        code: formatBeatCode(beat),
        username,
        ts: Date.now(),
      });
    } catch (error) {
      // Community-beats collection is best effort; the comment is already up.
      console.error('Error recording shared beat:', error);
    }

    return c.json<ShareBeatResponse>({
      type: 'beatShared',
      commentId: comment.id,
    });
  } catch (error) {
    console.error('Error sharing beat:', error);
    // The share did not happen: do not hold the cooldown against the user.
    await redis.del(limitKey);
    return c.json<ApiErrorResponse>(
      { status: 'error', message: 'Failed to share your beat' },
      400
    );
  }
});
