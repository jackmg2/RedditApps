import { MenuItem } from '@devvit/public-api';
import { setUserRatioByUsernameModal } from '../forms/setRatioByUsernameForm.js';

export const setRatioByUsernameMenuItem: MenuItem = {
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'Ratio: Set User Ratio by Username',
  onPress: async (event, context) => {
    context.ui.showForm(setUserRatioByUsernameModal);
  }
};