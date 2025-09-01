import { MenuItem, Devvit } from '@devvit/public-api';

// Note: Menu items can't use useForm hook since they're not React components
// We must use Devvit.createForm for menu item handlers
export const createCalendarPostMenuItem: MenuItem = {
  label: 'Create Community Calendar',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_, context) => {
    try {
      // For menu items, we need to use Devvit.createForm since useForm 
      // can only be used inside a component render context
      const form = Devvit.createForm(
        {
          fields: [
            {
              name: 'title',
              label: 'Title',
              type: 'string',
              defaultValue: 'Community Calendar',
              onValidate: (e: any) => e.value === '' ? 'Title required' : undefined
            }
          ],
          title: 'New Calendar Post',
          acceptLabel: 'Save',
        },
        async (event, formContext) => {
          const subreddit = await formContext.reddit.getCurrentSubreddit();
          const post = await formContext.reddit.submitPost({
            title: event.values.title,
            subredditName: subreddit.name,
            preview: <text size="large">Loading Community Calendar...</text>
          });
          formContext.ui.showToast({ text: 'Created Community Calendar post! Please refresh.' });
          formContext.ui.navigateTo(post);
        }
      );
      
      context.ui.showForm(form);
    } catch (error) {
      console.log(error);
      context.ui.showToast('Failed to create calendar.');
    }
  }
};