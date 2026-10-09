export const MAX_SHARE_MESSAGE_LENGTH = 200;
export const DEFAULT_SHARE_MESSAGE = 'Check out my beat! 🥁';

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
