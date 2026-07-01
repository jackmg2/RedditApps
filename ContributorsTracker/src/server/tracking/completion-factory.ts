import type { Post } from "@devvit/reddit";
import type { PostV2 } from "@devvit/shared";
import type { CompletedContribution, Contribution } from "./types.ts";
import { permalinkUrl } from "./ids.ts";
import { extractContributors } from "./text.ts";

export function completionFromTriggerPost(
  post: PostV2,
  authorName: string,
  trackedItem: Contribution,
  trackContributors: boolean = true,
): CompletedContribution {
  return {
    name: trackedItem.name,
    level: trackedItem.level,
    postId: post.id,
    title: post.title,
    url: permalinkUrl(post.permalink),
    createdUtc: Math.floor(post.createdAt / 1000),
    flair: post.linkFlair?.text ?? "",
    author: authorName,
    contributors: trackContributors ? extractContributors(post.title) : [],
    trackContributors,
    needsReview: trackedItem.needsReview ?? false,
  };
}

export function completionFromPost(
  post: Post,
  trackedItem: Contribution,
  trackContributors: boolean = true,
): CompletedContribution {
  return {
    name: trackedItem.name,
    level: trackedItem.level,
    postId: post.id,
    title: post.title,
    url: permalinkUrl(post.permalink),
    createdUtc: Math.floor(post.createdAt.getTime() / 1000),
    flair: post.flair?.text ?? "",
    author: post.authorName,
    contributors: trackContributors ? extractContributors(post.title) : [],
    trackContributors,
    needsReview: trackedItem.needsReview ?? false,
  };
}
