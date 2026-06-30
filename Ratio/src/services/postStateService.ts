import type { AppSettings } from '../types/AppSettings';
import type { PostClass, PostState } from '../types/PostState';
import { redisService, type UserCounts } from './redisService';
import { FlairUtils } from '../utils/flairUtils';

/**
 * All count transitions go through this service. A post only contributes to
 * its author's counts while its state has `counted = true`, which makes every
 * transition idempotent regardless of how many trigger events Reddit delivers
 * for the same underlying action (e.g. ModAction + PostDelete for one
 * removal).
 */
export class PostStateService {
  static classify(
    flairText: string | undefined,
    settings: AppSettings
  ): PostClass {
    const monitoredFlairs = FlairUtils.getMonitoredFlairs(settings);
    return FlairUtils.isMonitoredFlair(flairText, monitoredFlairs)
      ? 'monitored'
      : 'regular';
  }

  static async recordNewPost(
    postId: string,
    authorId: string,
    cls: PostClass,
    counted: boolean,
    flairText: string,
    appRemoved: boolean = false
  ): Promise<void> {
    await redisService.setPostState(postId, {
      class: cls,
      counted,
      authorId,
      flairText,
      removed: appRemoved,
      appRemoved,
    });
  }

  /**
   * Stops a post from counting because it was removed or deleted. Respects
   * the decrease* settings: when the relevant setting is off the post keeps
   * counting (only the `removed` flag is set), which also makes a later
   * approval a natural no-op. `transitioned` is false when this removal was
   * already processed (duplicate trigger delivery).
   */
  static async uncount(
    postId: string,
    state: PostState,
    settings: AppSettings
  ): Promise<{ transitioned: boolean; counts?: UserCounts }> {
    if (!state.counted) {
      if (!state.removed) {
        await redisService.setPostState(postId, { ...state, removed: true });
        return { transitioned: true };
      }
      return { transitioned: false };
    }

    const shouldDecrease =
      state.class === 'monitored'
        ? settings.decreaseMonitoredOnRemoval
        : settings.decreaseRegularOnRemoval;

    if (!shouldDecrease) {
      await redisService.setPostState(postId, { ...state, removed: true });
      return { transitioned: !state.removed };
    }

    const counts = await redisService.adjustUserCounts(
      state.authorId,
      state.class === 'regular' ? -1 : 0,
      state.class === 'monitored' ? -1 : 0
    );
    await redisService.setPostState(postId, {
      ...state,
      counted: false,
      removed: true,
    });
    return { transitioned: true, counts };
  }

  /**
   * Restores a removed post's count (mod approval). Only acts on posts that
   * are currently uncounted because of a removal; this includes app-removed
   * violation posts, where approving is an explicit mod override.
   */
  static async recount(
    postId: string,
    state: PostState
  ): Promise<{ transitioned: boolean; counts?: UserCounts }> {
    if (state.counted) {
      if (state.removed || state.appRemoved) {
        // Post never stopped counting (decrease* setting was off); approving
        // it just clears the removal flags.
        await redisService.setPostState(postId, {
          ...state,
          removed: false,
          appRemoved: false,
        });
        return { transitioned: true };
      }
      return { transitioned: false };
    }

    if (!state.removed && !state.appRemoved) {
      return { transitioned: false };
    }

    const counts = await redisService.adjustUserCounts(
      state.authorId,
      state.class === 'regular' ? 1 : 0,
      state.class === 'monitored' ? 1 : 0
    );
    await redisService.setPostState(postId, {
      ...state,
      counted: true,
      removed: false,
      appRemoved: false,
    });
    return { transitioned: true, counts };
  }

  /**
   * Moves a post between the regular and monitored classes, swapping the
   * author's counts when the post currently counts. Returns the new counts
   * when they changed.
   */
  static async reclassify(
    postId: string,
    state: PostState,
    newClass: PostClass,
    newFlairText: string
  ): Promise<{ changed: boolean; counts?: UserCounts | undefined }> {
    if (newClass === state.class) {
      if (newFlairText !== state.flairText) {
        await redisService.setPostState(postId, {
          ...state,
          flairText: newFlairText,
        });
      }
      return { changed: false };
    }

    let counts: UserCounts | undefined;
    if (state.counted) {
      counts = await redisService.adjustUserCounts(
        state.authorId,
        newClass === 'regular' ? 1 : -1,
        newClass === 'monitored' ? 1 : -1
      );
    }

    await redisService.setPostState(postId, {
      ...state,
      class: newClass,
      flairText: newFlairText,
    });

    return { changed: true, counts };
  }

  /**
   * Marks a post as removed by the app for a ratio violation. Unlike
   * `uncount` this always stops the post from counting (ignoring the
   * decrease* settings): violation posts never count. Returns the new counts
   * when they changed.
   */
  static async appRemove(postId: string): Promise<UserCounts | undefined> {
    const state = await redisService.getPostState(postId);
    if (!state) {
      return undefined;
    }

    let counts: UserCounts | undefined;
    if (state.counted) {
      counts = await redisService.adjustUserCounts(
        state.authorId,
        state.class === 'regular' ? -1 : 0,
        state.class === 'monitored' ? -1 : 0
      );
    }

    await redisService.setPostState(postId, {
      ...state,
      counted: false,
      removed: true,
      appRemoved: true,
    });
    return counts;
  }
}
