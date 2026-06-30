import { Hono } from 'hono';
import {
  EventSource,
  type OnModActionRequest,
  type OnPostDeleteRequest,
  type OnPostFlairUpdateRequest,
  type OnPostSubmitRequest,
  type TriggerResponse,
} from '@devvit/web/shared';
import { reddit } from '@devvit/web/server';
import { T2, T3 } from '@devvit/shared-types/tid.js';
import { getAppSettings } from '../config/appSettings';
import { RatioService } from '../services/ratioService';
import { WikiService } from '../services/wikiService';
import { redisService } from '../services/redisService';
import { PostStateService } from '../services/postStateService';
import { FlairService } from '../services/flairService';
import { ExemptUserUtils } from '../utils/exemptUserUtils';
import { buildRatioVars, renderTemplate } from '../utils/templateUtils';

export const triggers = new Hono();

function today(): string {
  return new Date().toISOString().split('T')[0]!;
}

function postLinkFromId(postId: string): string {
  return `https://www.reddit.com/comments/${postId.replace('t3_', '')}`;
}

triggers.post('/on-post-submit', async (c) => {
  const event = await c.req.json<OnPostSubmitRequest>();
  const settings = await getAppSettings();
  const post = event.post;

  if (post != null) {
    const userId = post.authorId;
    const username =
      event.author?.name ??
      (await reddit.getUserById(T2(userId)))?.username ??
      'unknown';

    // Check if user is exempt
    const exemptUsers = ExemptUserUtils.getExemptUsers(settings);
    const isExempt = ExemptUserUtils.isExemptUser(username, exemptUsers);

    if (isExempt) {
      console.log(`User ${username} is exempt from ratio rules`);
      // Still record the post for wiki tracking, but without ratio enforcement
      await WikiService.recordPost({
        authorName: username,
        date: today(),
        postTitle: post.title || 'Untitled',
        postLink: `https://www.reddit.com${post.permalink}`,
        ratio: 'EXEMPT',
      });
      return c.json<TriggerResponse>({ status: 'success' }, 200);
    }

    const flairText = post.linkFlair?.text ?? '';
    const cls = PostStateService.classify(post.linkFlair?.text, settings);

    // Get current post counts and calculate potential new counts
    const { regular, monitored } = await redisService.getUserCounts(userId);
    const newRegular = cls === 'regular' ? regular + 1 : regular;
    const newMonitored = cls === 'monitored' ? monitored + 1 : monitored;

    if (RatioService.checkRatioViolation(newRegular, newMonitored, settings)) {
      // Violation posts never count toward the ratio
      await PostStateService.recordNewPost(
        post.id,
        userId,
        cls,
        false,
        flairText,
        true
      );
      await RatioService.removePostForViolation(
        post.id,
        renderTemplate(
          settings.ratioViolationComment,
          buildRatioVars(username, regular, monitored, settings)
        )
      );
      await WikiService.recordPost({
        authorName: username,
        date: today(),
        postTitle: `[APP REMOVED] ${post.title || 'Untitled'}`,
        postLink: `https://www.reddit.com${post.permalink}`,
        ratio: 'VIOLATION - NO RATIO CHANGE',
      });
      return c.json<TriggerResponse>({ status: 'success' }, 200);
    }

    // Update the ratio and record the post
    try {
      await PostStateService.recordNewPost(
        post.id,
        userId,
        cls,
        true,
        flairText
      );
      const counts = await redisService.adjustUserCounts(
        userId,
        cls === 'regular' ? 1 : 0,
        cls === 'monitored' ? 1 : 0
      );
      await RatioService.updateUserFlairDisplay(
        userId,
        counts.regular,
        counts.monitored
      );

      // Record post for wiki tracking
      await WikiService.recordPost({
        authorName: username,
        date: today(),
        postTitle: post.title || 'Untitled',
        postLink: `https://www.reddit.com${post.permalink}`,
        ratio: `${counts.regular}/${counts.monitored}`,
      });

      // Tell the user when this post increased their allowance
      const earnedCredit = settings.invertedRatio
        ? cls === 'regular' &&
          Math.floor(counts.regular / settings.ratioValue) >
            Math.floor(regular / settings.ratioValue)
        : cls === 'monitored';

      if (
        settings.postCreditEarnedComment &&
        settings.creditEarnedComment !== '' &&
        earnedCredit
      ) {
        try {
          const commentResponse = await reddit.submitComment({
            id: T3(post.id),
            text: renderTemplate(
              settings.creditEarnedComment,
              buildRatioVars(
                username,
                counts.regular,
                counts.monitored,
                settings
              )
            ),
          });
          await commentResponse.distinguish(true);
        } catch (commentError) {
          console.error(
            `Failed to post credit earned comment: ${commentError}`
          );
        }
      }
    } catch (error) {
      console.error('Error updating user ratio:', error);
    }
  }

  return c.json<TriggerResponse>({ status: 'success' }, 200);
});

triggers.post('/on-post-delete', async (c) => {
  const event = await c.req.json<OnPostDeleteRequest>();
  const postId = event.postId;

  if (!postId) {
    return c.json<TriggerResponse>({ status: 'success' }, 200);
  }

  console.log('Post deleted:', postId);
  const settings = await getAppSettings();

  const username =
    event.author?.name ??
    (event.author?.id
      ? (await reddit.getUserById(T2(event.author.id)))?.username
      : undefined) ??
    'unknown';

  // Fetch the post for wiki display only; counts never depend on it when a
  // post state exists.
  let postTitle = '[deleted post]';
  let postLink = postLinkFromId(postId);
  try {
    const post = await reddit.getPostById(T3(postId));
    if (post) {
      postTitle = post.title || postTitle;
      postLink = `https://www.reddit.com${post.permalink}`;
    }
  } catch {
    console.log(`Could not fetch deleted post ${postId} for wiki display`);
  }

  // Check if user is exempt
  const exemptUsers = ExemptUserUtils.getExemptUsers(settings);
  if (ExemptUserUtils.isExemptUser(username, exemptUsers)) {
    console.log(`User ${username} is exempt from ratio rules`);
    await WikiService.recordPost({
      authorName: username,
      date: today(),
      postTitle: `[DELETED] ${postTitle}`,
      postLink,
      ratio: 'EXEMPT',
    });
    return c.json<TriggerResponse>({ status: 'success' }, 200);
  }

  const state = await redisService.getPostState(postId);

  if (state) {
    if (state.appRemoved && !state.counted) {
      // The app removed this post for a violation (already logged); the
      // author deleting it afterwards changes nothing.
      console.log('Post was removed by app - skipping ratio adjustment');
      return c.json<TriggerResponse>({ status: 'success' }, 200);
    }

    const result = await PostStateService.uncount(postId, state, settings);
    if (!result.transitioned) {
      // Duplicate delivery (e.g. ModAction already processed this removal)
      return c.json<TriggerResponse>({ status: 'success' }, 200);
    }

    const counts =
      result.counts ?? (await redisService.getUserCounts(state.authorId));
    if (result.counts) {
      await RatioService.updateUserFlairDisplay(
        state.authorId,
        counts.regular,
        counts.monitored
      );
    }

    const label =
      event.source === EventSource.MODERATOR
        ? '[MOD REMOVED]'
        : '[USER DELETED]';
    await WikiService.recordPost({
      authorName: username,
      date: today(),
      postTitle: `${label} ${postTitle}`,
      postLink,
      ratio: `${counts.regular}/${counts.monitored}`,
    });
    return c.json<TriggerResponse>({ status: 'success' }, 200);
  }

  // No state: post predates per-post tracking. Fall back to inferring the
  // class from the post's flair, like the old app did.
  const userId = event.author?.id;
  if (!userId) {
    console.error('Could not find author for deleted post without state');
    return c.json<TriggerResponse>({ status: 'success' }, 200);
  }

  let flairText: string | undefined;
  try {
    const post = await reddit.getPostById(T3(postId));
    flairText = post?.flair?.text;
  } catch {
    console.log(`Could not fetch deleted post ${postId} to classify it`);
  }

  const cls = PostStateService.classify(flairText, settings);
  const legacyState = {
    class: cls,
    counted: true,
    authorId: userId,
    flairText: flairText ?? '',
    removed: false,
    appRemoved: false,
  };
  const result = await PostStateService.uncount(postId, legacyState, settings);

  const counts =
    result.counts ?? (await redisService.getUserCounts(userId));
  if (result.counts) {
    await RatioService.updateUserFlairDisplay(
      userId,
      counts.regular,
      counts.monitored
    );
  }

  await WikiService.recordPost({
    authorName: username,
    date: today(),
    postTitle: `[USER DELETED] ${postTitle}`,
    postLink,
    ratio: `${counts.regular}/${counts.monitored}`,
  });

  return c.json<TriggerResponse>({ status: 'success' }, 200);
});

triggers.post('/on-post-flair-update', async (c) => {
  const event = await c.req.json<OnPostFlairUpdateRequest>();
  const post = event.post;

  if (!post) {
    return c.json<TriggerResponse>({ status: 'success' }, 200);
  }

  // Ignore flair writes the app itself performed (menu flows update the
  // counts themselves).
  if (await redisService.wasAppFlairSet(post.id)) {
    await redisService.clearAppFlairSet(post.id);
    console.log(`Ignoring app-initiated flair update for ${post.id}`);
    return c.json<TriggerResponse>({ status: 'success' }, 200);
  }

  const settings = await getAppSettings();
  const username =
    event.author?.name ??
    (await reddit.getUserById(T2(post.authorId)))?.username ??
    'unknown';

  const exemptUsers = ExemptUserUtils.getExemptUsers(settings);
  if (ExemptUserUtils.isExemptUser(username, exemptUsers)) {
    return c.json<TriggerResponse>({ status: 'success' }, 200);
  }

  const newFlairText = post.linkFlair?.text ?? '';
  const newClass = PostStateService.classify(post.linkFlair?.text, settings);

  const state = await redisService.getPostState(post.id);
  if (!state) {
    // Post predates per-post tracking: the previous class is unknowable, so
    // start tracking it under the new flair without adjusting any counts.
    await PostStateService.recordNewPost(
      post.id,
      post.authorId,
      newClass,
      true,
      newFlairText
    );
    console.log(
      `Started tracking pre-existing post ${post.id} as ${newClass}`
    );
    return c.json<TriggerResponse>({ status: 'success' }, 200);
  }

  await FlairService.applyClassChange({
    postId: post.id,
    state,
    newClass,
    newFlairText,
    username,
    settings,
    postTitle: post.title || 'Untitled',
    postLink: `https://www.reddit.com${post.permalink}`,
  });

  return c.json<TriggerResponse>({ status: 'success' }, 200);
});

triggers.post('/on-mod-action', async (c) => {
  const event = await c.req.json<OnModActionRequest>();
  const action = event.action ?? '';

  if (
    action !== 'removelink' &&
    action !== 'spamlink' &&
    action !== 'approvelink'
  ) {
    return c.json<TriggerResponse>({ status: 'success' }, 200);
  }

  const targetPost = event.targetPost;
  if (!targetPost?.id) {
    return c.json<TriggerResponse>({ status: 'success' }, 200);
  }

  // Ignore the app's own removals (violation enforcement shows up in the
  // modlog under the app account).
  try {
    const appUser = await reddit.getAppUser();
    if (appUser && event.moderator?.name === appUser.username) {
      console.log(`Ignoring app's own mod action on ${targetPost.id}`);
      return c.json<TriggerResponse>({ status: 'success' }, 200);
    }
  } catch (error) {
    console.error(`Could not resolve app user: ${error}`);
  }

  const settings = await getAppSettings();
  const username = event.targetUser?.name ?? 'unknown';

  const exemptUsers = ExemptUserUtils.getExemptUsers(settings);
  if (ExemptUserUtils.isExemptUser(username, exemptUsers)) {
    return c.json<TriggerResponse>({ status: 'success' }, 200);
  }

  let state = await redisService.getPostState(targetPost.id);
  if (!state) {
    // Post predates per-post tracking: assume it counted under its current
    // flair, matching the old app's inference on deletion.
    state = {
      class: PostStateService.classify(targetPost.linkFlair?.text, settings),
      counted: true,
      authorId: targetPost.authorId,
      flairText: targetPost.linkFlair?.text ?? '',
      removed: false,
      appRemoved: false,
    };
    await redisService.setPostState(targetPost.id, state);
  }

  const isApprove = action === 'approvelink';
  const result = isApprove
    ? await PostStateService.recount(targetPost.id, state)
    : await PostStateService.uncount(targetPost.id, state, settings);

  if (!result.transitioned) {
    // Duplicate delivery or nothing to do (e.g. approving a counted post)
    return c.json<TriggerResponse>({ status: 'success' }, 200);
  }

  const counts =
    result.counts ?? (await redisService.getUserCounts(state.authorId));
  if (result.counts) {
    await RatioService.updateUserFlairDisplay(
      state.authorId,
      counts.regular,
      counts.monitored
    );
  }

  await WikiService.recordPost({
    authorName: username,
    date: today(),
    postTitle: `${isApprove ? '[MOD APPROVED]' : '[MOD REMOVED]'} ${targetPost.title || 'Untitled'}`,
    postLink: `https://www.reddit.com${targetPost.permalink}`,
    ratio: `${counts.regular}/${counts.monitored}`,
  });

  return c.json<TriggerResponse>({ status: 'success' }, 200);
});
