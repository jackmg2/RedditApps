export * from './commentHandlers.js';
export * from './userHandlers.js';
export * from './sharedHandlers.js';

import { FormOnSubmitEvent, JSONObject, Devvit } from '@devvit/public-api';

export async function handleViewAllComments(
  event: FormOnSubmitEvent<JSONObject>,
  context: Devvit.Context
): Promise<void> {
  // No action needed, just close the form
}