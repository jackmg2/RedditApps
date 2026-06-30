import { Hono } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
import type {
  ApiErrorResponse,
  FavoritesResponse,
  InitResponse,
  SaveCompositionRequest,
  SaveCompositionResponse,
  SaveFavoriteRequest,
  ShareCompositionRequest,
  ShareCompositionResponse,
  UpdateFavoritesRequest,
} from '../../shared/api';

const MAX_FAVORITE_NOTES = 10;
const MAX_COMPOSITIONS_PER_USER = 50;

const favoritesKey = (postId: string) => `favorite_notes_${postId}`;

const getFavorites = async (postId: string): Promise<string[]> => {
  const saved = await redis.get(favoritesKey(postId));
  if (!saved) return [];
  const parsed: unknown = JSON.parse(saved);
  return Array.isArray(parsed) ? parsed.filter((n) => typeof n === 'string') : [];
};

const setFavorites = async (postId: string, notes: string[]): Promise<void> => {
  await redis.set(favoritesKey(postId), JSON.stringify(notes));
};

type CompositionMeta = {
  key: string;
  created: number;
  duration: number;
  frameCount: number;
  postId: string;
};

export const api = new Hono();

api.get('/init', async (c) => {
  const { postId } = context;

  if (!postId) {
    console.error('API Init Error: postId not found in devvit context');
    return c.json<ApiErrorResponse>(
      { status: 'error', message: 'postId is required but missing from context' },
      400
    );
  }

  try {
    const favoriteNotes = await getFavorites(postId);
    return c.json<InitResponse>({ type: 'init', postId, favoriteNotes });
  } catch (error) {
    console.error(`API Init Error for post ${postId}:`, error);
    const message =
      error instanceof Error
        ? `Initialization failed: ${error.message}`
        : 'Unknown error during initialization';
    return c.json<ApiErrorResponse>({ status: 'error', message }, 400);
  }
});

api.post('/favorites/save', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ApiErrorResponse>({ status: 'error', message: 'postId is required' }, 400);
  }

  const body = await c.req.json<SaveFavoriteRequest>();
  let notes = await getFavorites(postId);

  // Remove if present; re-add at the end with a rolling limit of 10
  notes = notes.filter((note) => note !== body.note);
  if (body.action !== 'remove') {
    notes.push(body.note);
    if (notes.length > MAX_FAVORITE_NOTES) {
      notes = notes.slice(-MAX_FAVORITE_NOTES);
    }
  }

  await setFavorites(postId, notes);
  return c.json<FavoritesResponse>({ type: 'favorites', favoriteNotes: notes });
});

api.post('/favorites/update', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ApiErrorResponse>({ status: 'error', message: 'postId is required' }, 400);
  }

  const body = await c.req.json<UpdateFavoritesRequest>();
  const notes = body.favoriteNotes.slice(0, MAX_FAVORITE_NOTES);
  await setFavorites(postId, notes);
  return c.json<FavoritesResponse>({ type: 'favorites', favoriteNotes: notes });
});

api.post('/favorites/clear', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ApiErrorResponse>({ status: 'error', message: 'postId is required' }, 400);
  }

  await setFavorites(postId, []);
  return c.json<FavoritesResponse>({ type: 'favorites', favoriteNotes: [] });
});

api.post('/composition/save', async (c) => {
  const { postId, userId } = context;
  if (!postId) {
    return c.json<ApiErrorResponse>({ status: 'error', message: 'postId is required' }, 400);
  }
  if (!userId) {
    return c.json<ApiErrorResponse>(
      { status: 'error', message: 'You must be logged in to save compositions' },
      401
    );
  }

  try {
    const { composition } = await c.req.json<SaveCompositionRequest>();

    const compositionKey = `composition_${postId}_${userId}_${Date.now()}`;
    await redis.set(compositionKey, JSON.stringify(composition));

    const userCompositionsKey = `user_compositions_${userId}`;
    const existing = await redis.get(userCompositionsKey);
    const compositions: CompositionMeta[] = existing ? JSON.parse(existing) : [];

    compositions.push({
      key: compositionKey,
      created: composition.created,
      duration: composition.duration,
      frameCount: composition.frameCount,
      postId,
    });

    if (compositions.length > MAX_COMPOSITIONS_PER_USER) {
      compositions.splice(0, compositions.length - MAX_COMPOSITIONS_PER_USER);
    }

    await redis.set(userCompositionsKey, JSON.stringify(compositions));

    return c.json<SaveCompositionResponse>({ type: 'compositionSaved' });
  } catch (error) {
    console.error('Error saving composition:', error);
    return c.json<ApiErrorResponse>(
      { status: 'error', message: 'Failed to save composition' },
      400
    );
  }
});

api.post('/composition/share', async (c) => {
  const { postId } = context;
  if (!postId) {
    return c.json<ApiErrorResponse>({ status: 'error', message: 'postId is required' }, 400);
  }

  try {
    const body = await c.req.json<ShareCompositionRequest>();

    const durationSeconds = Math.floor(body.duration / 1000);
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Username appears only in the public comment, never in the app UI
    const username = (await reddit.getCurrentUsername()) ?? 'anonymous';

    const commentText = `${body.message}

🎵 **MIDI Mini Music** 🎵
- Duration: ${durationStr}
- Notes: ${body.noteCount}
- Scale: ${body.scaleDisplayName}
- Octave: ${body.octave}
- Created by: u/${username}

**Composition Code:**
\`\`\`
${body.encodedComposition}
\`\`\`

*Copy the code above and use "Import" to play this composition!*`;

    const comment = await reddit.submitComment({ id: postId, text: commentText });

    return c.json<ShareCompositionResponse>({
      type: 'compositionShared',
      commentId: comment.id,
    });
  } catch (error) {
    console.error('Error sharing composition:', error);
    return c.json<ApiErrorResponse>(
      { status: 'error', message: 'Failed to share composition' },
      400
    );
  }
});
