/** Message from Devvit to the web view. */
export type DevvitMessage =
  | { type: 'initialData'; data: { username: string; favoriteNotes: string[] } }
  | { type: 'updateFavorites'; data: { favoriteNotes: string[] } };

/** Message from the web view to Devvit. */
export type WebViewMessage =
  | { type: 'webViewReady' }
  | { type: 'saveFavoriteNote'; data: { note: string; action?: string } }
  | { type: 'updateFavoritesList'; data: { favoriteNotes: string[] } }
  | { type: 'clearFavorites' };

/**
 * Web view MessageEvent listener data type. The Devvit API wraps all messages
 * from Blocks to the web view.
 */
export type DevvitSystemMessage = {
  data: { message: DevvitMessage };
  /** Reserved type for messages sent via `context.ui.webView.postMessage`. */
  type?: 'devvit-message' | string;
};