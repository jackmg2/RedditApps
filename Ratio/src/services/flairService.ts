import { reddit } from '@devvit/web/server';
import { T2, T3 } from '@devvit/shared-types/tid.js';
import type { AppSettings } from '../types/AppSettings';
import type { PostClass, PostState } from '../types/PostState';
import { getAppSettings } from '../config/appSettings';
import { RatioService } from './ratioService';
import { WikiService } from './wikiService';
import { redisService } from './redisService';
import { PostStateService } from './postStateService';
import { FlairUtils } from '../utils/flairUtils';
import { ExemptUserUtils } from '../utils/exemptUserUtils';
import { buildRatioVars, renderTemplate } from '../utils/templateUtils';

export interface FlairServiceResult {
  success: boolean;
  message: string;
}

export type ClassChangeOutcome = 'unchanged' | 'updated' | 'removed';

export class FlairService {
  /**
   * Applies a post's class change (regular <-> monitored): swaps the author's
   * counts, posts the wrong-flair comment when a monitored post becomes
   * regular, and removes the post if the new classification violates the
   * ratio. Shared by the moderator menu flow and the PostFlairUpdate trigger.
   */
  static async applyClassChange(options: {
    postId: string;
    state: PostState;
    newClass: PostClass;
    newFlairText: string;
    username: string;
    settings: AppSettings;
    postTitle: string;
    postLink: string;
  }): Promise<ClassChangeOutcome> {
    const {
      postId,
      state,
      newClass,
      newFlairText,
      username,
      settings,
      postTitle,
      postLink,
    } = options;

    const wasMonitored = state.class === 'monitored';
    const result = await PostStateService.reclassify(
      postId,
      state,
      newClass,
      newFlairText
    );

    if (!result.changed) {
      return 'unchanged';
    }

    let counts =
      result.counts ?? (await redisService.getUserCounts(state.authorId));

    // Wrong-flair comment when a monitored post becomes regular
    if (
      wasMonitored &&
      newClass === 'regular' &&
      settings.wrongFlairComment !== ''
    ) {
      try {
        const commentResponse = await reddit.submitComment({
          id: T3(postId),
          text: renderTemplate(
            settings.wrongFlairComment,
            buildRatioVars(username, counts.regular, counts.monitored, settings)
          ),
        });
        await commentResponse.distinguish(true);
      } catch (commentError) {
        console.error(`Failed to post wrong flair comment: ${commentError}`);
      }
    }

    // Only a counted post can push the user into violation
    if (
      result.counts &&
      RatioService.checkRatioViolation(
        counts.regular,
        counts.monitored,
        settings
      )
    ) {
      console.log(`New classification violates the ratio, removing post`);
      counts = (await PostStateService.appRemove(postId)) ?? counts;

      await RatioService.removePostForViolation(
        postId,
        renderTemplate(
          settings.ratioViolationComment,
          buildRatioVars(username, counts.regular, counts.monitored, settings)
        )
      );

      await RatioService.updateUserFlairDisplay(
        state.authorId,
        counts.regular,
        counts.monitored
      );

      await WikiService.recordPost({
        authorName: username,
        date: new Date().toISOString().split('T')[0]!,
        postTitle: `[FLAIR CHANGE - VIOLATION] ${postTitle}`,
        postLink,
        ratio: `${counts.regular}/${counts.monitored}`,
      });

      return 'removed';
    }

    if (result.counts) {
      await RatioService.updateUserFlairDisplay(
        state.authorId,
        counts.regular,
        counts.monitored
      );
    }

    await WikiService.recordPost({
      authorName: username,
      date: new Date().toISOString().split('T')[0]!,
      postTitle: `[FLAIR CHANGE] ${postTitle}`,
      postLink,
      ratio: `${counts.regular}/${counts.monitored}`,
    });

    return 'updated';
  }

  /** Moderator menu flow: set the post's flair, then reclassify. */
  static async updateFlairAndRatio(
    userId: string,
    currentPostFlair: string,
    selectedPostFlair: string,
    postId: string
  ): Promise<FlairServiceResult> {
    try {
      const settings = await getAppSettings();
      const user = await reddit.getUserById(T2(userId));
      const username = user?.username || 'unknown';

      console.log(
        `Updating flair for user ${username} from "${currentPostFlair}" to "${selectedPostFlair}"`
      );

      // Check if user is exempt
      const exemptUsers = ExemptUserUtils.getExemptUsers(settings);
      const isExempt = ExemptUserUtils.isExemptUser(username, exemptUsers);

      // Update the post's flair regardless of exempt status
      try {
        await FlairUtils.updatePostFlair(postId, selectedPostFlair);
        console.log(`Post flair updated successfully`);
      } catch (flairError) {
        console.error(`Failed to update post flair: ${flairError}`);
        return {
          success: false,
          message: `Failed to update post flair: ${flairError instanceof Error ? flairError.message : 'Unknown error'}`,
        };
      }

      if (isExempt) {
        console.log(`User ${username} is exempt from ratio rules`);
        return {
          success: true,
          message: `Post flair ${selectedPostFlair === '' ? 'removed' : 'modified'} for exempt user, please refresh.`,
        };
      }

      // Posts that predate per-post tracking are assumed to count under the
      // flair the moderator sees in the form.
      let state = await redisService.getPostState(postId);
      if (!state) {
        state = {
          class: PostStateService.classify(currentPostFlair, settings),
          counted: true,
          authorId: userId,
          flairText: currentPostFlair,
          removed: false,
          appRemoved: false,
        };
        await redisService.setPostState(postId, state);
      }

      const newClass = PostStateService.classify(selectedPostFlair, settings);

      const outcome = await this.applyClassChange({
        postId,
        state,
        newClass,
        newFlairText: selectedPostFlair,
        username,
        settings,
        postTitle: `From "${currentPostFlair}" to "${selectedPostFlair}"`,
        postLink: `https://www.reddit.com/comments/${postId.replace('t3_', '')}`,
      });

      if (outcome === 'removed') {
        return {
          success: true,
          message: `Post flair modified but post was removed due to ratio violation.`,
        };
      }

      return {
        success: true,
        message: `Post flair ${selectedPostFlair === '' ? 'removed' : 'modified'}, please refresh.`,
      };
    } catch (error) {
      console.error(`Error in updateFlairAndRatio: ${error}`);
      if (error instanceof Error && error.message) {
        return {
          success: false,
          message: `An error occurred: ${error.message}`,
        };
      }
      return {
        success: false,
        message: 'An unknown error occurred while updating the flair.',
      };
    }
  }
}
