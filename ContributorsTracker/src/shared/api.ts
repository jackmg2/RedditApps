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
  needsReview?: boolean;
};

export type UserItemsResponse = {
  type: "userItems" | "userContributions";
  username: string;
  count: number;
  items: TrackedItemRecord[];
  contributions?: TrackedItemRecord[];
};

export type CompletedContribution = TrackedItemRecord;
export type UserContributionsResponse = UserItemsResponse;

export const ApiEndpoint = {
  UserItems: "/api/user-contributions",
  OnAppInstall: "/internal/on-app-install",
  OnTrackedPostCreate: "/internal/tracking/post-create",
  OnTrackedPostFlairUpdate: "/internal/tracking/post-flair-update",
  OnTrackedPostDelete: "/internal/tracking/post-delete",
  OnTrackedModAction: "/internal/tracking/mod-action",
  OnTrackedBackfill: "/internal/tracking/backfill",
  OnTrackingConfigOpen: "/internal/tracking/config-open",
  OnTrackingConfigSubmit: "/internal/tracking/config-submit",
  OnPostCommentManual: "/internal/tracking/post-comment",
  OnReviewOpen: "/internal/tracking/review-open",
  OnSetTitleSubmit: "/internal/tracking/set-title-submit",
  OnSetUsersSubmit: "/internal/tracking/set-users-submit",
  // Compatibility endpoint keys.
  UserContributions: "/api/user-contributions",
  OnCommunityContributionPostCreate: "/internal/tracking/post-create",
  OnCommunityContributionPostFlairUpdate: "/internal/tracking/post-flair-update",
  OnCommunityContributionPostDelete: "/internal/tracking/post-delete",
  OnCommunityContributionBackfill: "/internal/tracking/backfill",
} as const;

export type ApiEndpoint = (typeof ApiEndpoint)[keyof typeof ApiEndpoint];
