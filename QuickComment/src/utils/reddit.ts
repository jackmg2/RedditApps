import { reddit } from '@devvit/web/server';
import type { PostFlair } from '../types/index.js';
import type { T3 } from '@devvit/shared-types/tid.js';

export async function getSubredditFlairs(subredditName: string): Promise<PostFlair[]> {
  try {
    const flairs = await reddit.getPostFlairTemplates(subredditName);
    return flairs.map((f) => ({ id: f.id, text: f.text || 'No text' }));
  } catch (error) {
    console.error('Error fetching flairs:', error);
    return [];
  }
}

export async function postComment(postId: string, text: string, shouldPin: boolean): Promise<string> {
  const comment = await reddit.submitComment({ id: postId as T3, text });
  let message = 'Comment added';
  if (shouldPin) {
    await comment.distinguish(true);
    message += ' and pinned';
  }
  return message + '.';
}
