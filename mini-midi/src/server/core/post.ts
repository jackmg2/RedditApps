import { reddit } from '@devvit/web/server';

export const createPost = async (title: string) => {
  return await reddit.submitCustomPost({ title });
};
