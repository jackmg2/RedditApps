import { context, reddit } from '@devvit/web/server';
import { trackPost } from '../toolkit/contentTracker';

export const createPost = async (title: string) => {
  const post = await reddit.submitCustomPost({ title });
  await trackPost(post.id);
  return post;
};

/**
 * Removal sync author-deletes a mod-removed post before running cleanup, but
 * a failure there is easy to miss. Re-check the post and delete it if it is
 * still the app's, logging enough to tell why the first attempt failed.
 * Post.delete() refuses unless authorName === context.appName exactly.
 */
export const ensurePostDeleted = async (postId: string): Promise<void> => {
  const post = await reddit.getPostById(postId as `t3_${string}`);
  const app = await reddit.getAppUser();
  console.log(
    `ensurePostDeleted ${postId}: author=${post.authorName} appName=${context.appName} appUser=${app?.username} removed=${post.removed}`
  );
  if (post.authorName === '[deleted]') return; // already author-deleted
  if (post.authorName.toLowerCase() !== app?.username.toLowerCase()) return;
  await post.delete();
  console.log(`ensurePostDeleted ${postId}: deleted`);
};
