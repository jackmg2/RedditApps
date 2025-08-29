import { MenuItem, Devvit } from '@devvit/public-api';

export const createCalendarPostMenuItem: MenuItem = {
  label: 'Create Community Calendar',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_, context) => {
    try {
      context.ui.showForm(createCalendarPostForm);
    } catch (error) {
      console.log(error);
      context.ui.showToast('Failed to create calendar.');
    }
  }
};

const createCalendarPostForm = Devvit.createForm(
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
  async (event, context) => {
    const subreddit = await context.reddit.getCurrentSubreddit();
    const post = await context.reddit.submitPost({
      title: event.values.title,
      subredditName: subreddit.name,
      preview: <text size="large">Loading Community Calendar...</text>
    });
    context.ui.showToast({ text: 'Created Community Calendar post! Please refresh.' });
    context.ui.navigateTo(post);
  }
);
