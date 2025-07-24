import { Devvit } from '@devvit/public-api';
import { PostFlair } from '../types/index.js';

export async function getSubredditFlairs(context: Devvit.Context): Promise<PostFlair[]> {
  try {
    const subreddit = await context.reddit.getCurrentSubreddit();
    const flairs = await context.reddit.getPostFlairTemplates(subreddit.name);
    return flairs.map(f => ({ id: f.id, text: f.text || 'No text' }));
  } catch (error) {
    console.error('Error fetching flairs:', error);
    return [];
  }
}

export async function postComment(
  context: Devvit.Context, 
  postId: string, 
  text: string, 
  shouldPin: boolean
): Promise<void> {
  let message = 'Comment added';
  
  const commentResponse = await context.reddit.submitComment({
    id: postId,
    text: text
  });

  if (shouldPin) {
    await commentResponse.distinguish(true);
    message += ' and pinned';
  }
  
  message += '.';
  context.ui.showToast(message);
}