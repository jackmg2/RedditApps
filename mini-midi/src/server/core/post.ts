import { reddit } from '@devvit/web/server';
import { trackPost } from '../toolkit/contentTracker';

export const createPost = async (title: string) => {
  const post = await reddit.submitCustomPost({ title });
  await trackPost(post.id);
  return post;
};
