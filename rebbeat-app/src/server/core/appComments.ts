// Comments the app account wrote under a Rebbeat post. Shares are posted as
// the member (runAs: 'USER'), but older shares, or ones made while posting as
// the user was unavailable, were authored by the app account and never
// tracked. Removal sync author-deletes the post itself, so those comments
// would be left behind: find them by author instead of by registry.
import { reddit } from '@devvit/web/server';

/** Author-deletes every top-level comment the app account wrote under the
 *  post. Members' own comments are never touched. Best effort per comment. */
export const deleteAppCommentsUnderPost = async (
  postId: string
): Promise<void> => {
  const app = await reddit.getAppUser();
  if (!app) return;

  const comments = await reddit
    .getComments({
      postId: postId as `t3_${string}`,
      limit: 1000,
      pageSize: 100,
    })
    .all();
  for (const comment of comments) {
    if (comment.authorName !== app.username) continue;
    try {
      await comment.delete();
    } catch (error) {
      console.error(`Error deleting app comment ${comment.id}:`, error);
    }
  }
};
