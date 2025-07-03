/** Message from Devvit to the web view. */
export type DevvitMessage =
  | { type: 'initialData'; data: { username: string; bestTime?: number } }
  | { type: 'newBestTime'; data: { time: number; isPersonalBest: boolean; leaderboard: LeaderboardEntry[]; userPosition: number } }
  | { type: 'leaderboardData'; data: { leaderboard: LeaderboardEntry[] } };

/** Message from the web view to Devvit. */
export type WebViewMessage =
  | { type: 'webViewReady' }
  | { type: 'raceStart' }
  | { type: 'raceComplete'; data: { time: number; username: string } }
  | { type: 'raceFailed'; data: { distance: number; username: string } }
  | { type: 'requestLeaderboard' };

/** Leaderboard entry structure */
export type LeaderboardEntry = {
  username: string;
  time: number;
  date: string;
};

/**
 * Web view MessageEvent listener data type. The Devvit API wraps all messages
 * from Blocks to the web view.
 */
export type DevvitSystemMessage = {
  data: { message: DevvitMessage };
  /** Reserved type for messages sent via `context.ui.webView.postMessage`. */
  type?: 'devvit-message' | string;
};