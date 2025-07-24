export * from './commentHandlers.js';
export * from './userHandlers.js';

import { FormOnSubmitEvent, JSONObject, Devvit } from '@devvit/public-api';

// Handler for viewing all comments (no action needed)
export async function handleViewAllComments(
  event: FormOnSubmitEvent<JSONObject>,
  context: Devvit.Context
): Promise<void> {
  // No action needed, just close the form
}