export type PostClass = 'regular' | 'monitored';

/**
 * Per-post tracking state stored in Redis (`post:<t3_id>` hash). Makes every
 * count transition idempotent: a post only ever contributes to its author's
 * counts while `counted` is true, no matter how many trigger events arrive.
 */
export interface PostState {
  class: PostClass;
  /** Whether this post currently contributes to the author's counts. */
  counted: boolean;
  authorId: string;
  flairText: string;
  /** Post is currently deleted/removed (by anyone). */
  removed: boolean;
  /** Post was removed by this app for a ratio violation. */
  appRemoved: boolean;
}
