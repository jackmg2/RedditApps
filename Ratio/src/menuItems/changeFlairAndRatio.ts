import { MenuItem } from '@devvit/public-api';
import { AppSettings } from '../types/AppSettings.js';
import { changeFlairAndRatioModal } from '../forms/changeFlairForm.js';

export const changeFlairAndRatioMenuItem: MenuItem = {
  location: 'post',
  forUserType: 'moderator',
  label: 'Ratio: Change flair and update ratio',
  onPress: async (event, context) => {
    try {
      const postId = context.postId as string;
      
      if (!postId) {
        context.ui.showToast('Error: No post ID found');
        return;
      }

      const post = await context.reddit.getPostById(postId);
      
      if (!post) {
        context.ui.showToast('Error: Could not find post');
        return;
      }

      const userId = post.authorId as `t2_${string}`;
      const user = await context.reddit.getUserById(userId);

      if (!user) {
        context.ui.showToast('Error: Could not find user');
        return;
      }

      const settings = await context.settings.getAll() as AppSettings;
      const possibleFlairs = settings.monitoredFlair
        .split(';')
        .map(flair => flair.trim())
        .filter(flair => flair.length > 0)
        .map(flair => ({ label: flair, value: flair }));

      possibleFlairs.push({ label: 'No flair', value: '' });

      const currentFlairText = post.flair?.text || 'No flair';

      console.log(`Opening change flair modal for user ${user.username}, post ${postId}, current flair: "${currentFlairText}"`);

      context.ui.showForm(changeFlairAndRatioModal, {
        userId: user.id,
        username: user.username,
        possibleFlairs: possibleFlairs,
        currentSelectedPostFlair: currentFlairText,
        postId: postId
      });
    } catch (error) {
      console.error(`Error in changeFlairAndRatioMenuItem: ${error}`);
      context.ui.showToast(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
};