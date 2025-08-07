import { MenuItem } from '@devvit/public-api';
import { FlairService } from '../services/flairService.js';

export const removeFlairMenuItem: MenuItem = {
  location: 'post',
  forUserType: 'moderator',
  label: 'Ratio: Remove flair',
  onPress: async (event, context) => {
    const post = await context.reddit.getPostById(context.postId as string);
    const userId = post.authorId as `t2_${string}`;
    const currentPostFlair = post.flair?.text;

    // Only proceed if the post has a flair
    if (!currentPostFlair) {
      context.ui.showToast('This post does not have a flair to remove.');
      return;
    }

    // Use the flair service to update flair and ratio
    await FlairService.updateFlairAndRatio(
      context, 
      userId, 
      currentPostFlair, 
      '', 
      context.postId as string
    );
  }
};