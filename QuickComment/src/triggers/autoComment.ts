import { Context } from '@devvit/public-api';
import { CommentSelector } from '../utils/commentSelector.js';

export const autoCommentTrigger = {
  event: 'PostSubmit' as const,
  onEvent: async (event, context) => {
    const settings = await context.settings.getAll();

    if (!settings.autoCommentEnabled) {
      return; // Auto-commenting is disabled
    }

    try {
      const post = event.post;
      if (post) {
        const selector = new CommentSelector(context);
        const { commentText, shouldPin } = await selector.selectComment(post);

        if (commentText) {
          const commentResponse = await context.reddit.submitComment({
            id: post.id,
            text: commentText
          });

          // Pin the comment if needed
          if (shouldPin) {
            await commentResponse.distinguish(true);
          }
        }
      }
    } catch (error) {
      console.error('Error in auto-comment trigger:', error);
    }
  }
};