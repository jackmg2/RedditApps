export const MAX_SHARE_MESSAGE_LENGTH = 200;
export const SHARE_MESSAGE_REQUIRED = 'Write a message to post your beat.';

/**
 * Plain-text message: one paragraph, at most 200 characters, and nothing that
 * markdown would turn into a heading, quote, list or code fence (a fence would
 * swallow the beat code block below it).
 */
export const sanitizeShareMessage = (raw: unknown): string => {
  const text = typeof raw === 'string' ? raw : '';
  const flat = text
    .replace(/`/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/^[\s#>*+-]+/, '')
    .trim();
  return Array.from(flat)
    .slice(0, MAX_SHARE_MESSAGE_LENGTH)
    .join('')
    .trim();
};

// GET /api/init
export type InitResponse = {
  type: 'init';
  postId: string;
  canShare: boolean; // a logged-in user is present in the request context
  canSetDefault: boolean; // a moderator with the 'posts' permission
  defaultBeat: string | null; // BB1 code set by a moderator; null = starter kit
};

// POST /api/beat/share
export type ShareBeatRequest = {
  code: string; // BB1 code; the server re-parses and re-formats it
  message: string;
};
export type ShareBeatResponse = {
  type: 'beatShared';
  commentId: string;
};

// POST /api/beat/default (moderators with the 'posts' permission)
export type SetDefaultBeatRequest = {
  code: string | null; // BB1 code; null restores the starter kit
};
export type SetDefaultBeatResponse = {
  type: 'defaultBeatSet';
  defaultBeat: string | null; // the server-formatted code that was stored
};

export type ApiErrorResponse = { status: 'error'; message: string };
