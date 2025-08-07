import { MenuItem } from '@devvit/public-api';
import { AppSettings } from '../types/AppSettings.js';
import { changeFlairAndRatioModal } from '../forms/changeFlairForm.js';

export const changeFlairAndRatioMenuItem: MenuItem = {
  location: 'post',
  forUserType: 'moderator',
  label: 'Ratio: Change flair and update ratio',
  onPress: async (event, context) => {
    const post = await context.reddit.getPostById(context.postId as string);
    const userId = post.authorId as `t2_${string}`;
    const user = await context.reddit.getUserById(userId);

    if (user) {
      const settings = await context.settings.getAll() as AppSettings;
      const possibleFlairs = settings.monitoredFlair
        .split(';')
        .map(flair => flair.trim())
        .filter(flair => flair.length > 0)
        .map(flair => ({ label: flair, value: flair }));

      possibleFlairs.push({ label: 'No flair', value: '' });

      context.ui.showForm(changeFlairAndRatioModal, {
        userId: user.id,
        username: user.username,
        possibleFlairs: possibleFlairs,
        currentSelectedPostFlair: post.flair?.text ?? 'No flair',
        postId: context.postId as string
      });
    }
  }
};