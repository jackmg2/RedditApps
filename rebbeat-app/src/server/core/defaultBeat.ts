// Per-post default beat: what a member sees the first time they open the post
// (no local draft yet). Set by a moderator; unset means the starter kit.
// Stored as a BB1 code the server formatted itself, never the client's text.
import { redis } from '@devvit/web/server';
import { type Beat, formatBeatCode, parseBeatCode } from '../../shared/beat';

const defaultKey = (postId: string) => `beat:default:${postId}`;

export const getDefaultBeatCode = async (
  postId: string
): Promise<string | null> => {
  const code = await redis.get(defaultKey(postId));
  // Re-validate on read so a stale or corrupt value falls back to the starter.
  return code && parseBeatCode(code) ? code : null;
};

export const setDefaultBeat = async (
  postId: string,
  beat: Beat
): Promise<string> => {
  const code = formatBeatCode(beat);
  await redis.set(defaultKey(postId), code);
  return code;
};

export const clearDefaultBeat = async (postId: string): Promise<void> => {
  await redis.del(defaultKey(postId));
};
