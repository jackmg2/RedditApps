import { MenuItem } from '@devvit/public-api';
import { RatioService } from '../services/ratioService.js';
import { manualRatioModificationModal } from '../forms/manualRatioForm.js';

export const manualRatioMenuItem: MenuItem = {
  location: 'post',
  forUserType: 'moderator',
  label: 'Ratio: Manually set user ratio',
  onPress: async (event, context) => {
    const post = await context.reddit.getPostById(context.postId as string);
    const userId = post.authorId as `t2_${string}`;
    const [regularPosts, monitoredPosts] = await RatioService.getUserRatio(userId, context);
    const user = await context.reddit.getUserById(userId);
    
    if (user) {
      context.ui.showForm(manualRatioModificationModal, {
        username: user.username,
        userId: user.id,
        regularPosts: regularPosts,
        monitoredPosts: monitoredPosts
      });
    }
  }
};