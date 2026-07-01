export type TrackedItem = {
  name: string;
  level: string;
  aliases: string[];
  needsReview?: boolean;
};

export type TrackedFlairRuleSource = "default" | "manual";

export type TrackedFlairRule = {
  flairText: string;
  normalizedFlairText: string;
  trackContributors: boolean;
  matchSentences: string[];
  source: TrackedFlairRuleSource;
};

export type TrackedItemRecord = {
  name: string;
  level: string;
  postId: string;
  title: string;
  url: string;
  createdUtc: number;
  flair: string;
  author: string;
  contributors: string[];
  trackContributors?: boolean;
  needsReview?: boolean;
};

export type UserItemsResult = {
  type: "userItems" | "userContributions";
  username: string;
  count: number;
  items: TrackedItemRecord[];
  contributions?: TrackedItemRecord[];
};

export type UserSyncMeta = {
  username: string;
  subredditName?: string;
  lastFullSyncAtUtc: number;
  lastFullSyncLimit: number;
  completionCount: number;
};

export type BackfillTaskData = {
  username: string;
  subredditName?: string;
};

export type BackfillState = BackfillTaskData & {
  after?: string;
  limit: number;
  processed: number;
};

export type TrackPostResult = {
  tracked: boolean;
  reason?: string;
  item?: TrackedItemRecord;
  contribution?: TrackedItemRecord;
};

export type UntrackPostResult = {
  untracked: boolean;
  reason?: string;
};

export type CompletionEntry = {
  key: string;
  item: TrackedItemRecord;
  contribution?: TrackedItemRecord;
};

// Compatibility aliases while callsites migrate to neutral names.
export type Contribution = TrackedItem;
export type CompletedContribution = TrackedItemRecord;
export type ScanUserResult = UserItemsResult;
