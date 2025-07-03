import { Devvit } from '@devvit/public-api';

// Adds a new menu item to the subreddit allowing to create a new post
Devvit.addMenuItem({
  label: '🏃‍♂️ Create Reddit Runner Game',
  location: 'subreddit',
  onPress: async (_, context) => {
    try {
      context.ui.showForm(Devvit.createForm(
        {
          fields: [
            {
              name: 'title',
              label: 'Title',
              type: 'string',
              defaultValue: '🏃‍♂️ Runnit - 100m Sprint Challenge! 🏆',
              onValidate: (e: any) => e.value === '' ? 'Title required' : undefined
            }
          ],
          title: '🏃‍♂️ Create Runnit Game',
          acceptLabel: 'Create Game',
        },
        async (event, context) => {
          const subreddit = await context.reddit.getCurrentSubreddit();
          const post = await context.reddit.submitPost({
            title: event.values.title,
            subredditName: subreddit.name,
            preview: (
              <vstack height="100%" width="100%" alignment="middle center" gap="medium">
                <text size="xxlarge">🏃‍♂️</text>
                <text size="large" weight="bold">Loading Runnit...</text>
                <text size="medium" color="secondary">100m Sprint Challenge</text>
                <text size="small">🏆 Beat your best time! 🏆</text>
                <hstack gap="small" alignment="center middle">
                  <text size="small" color="secondary">Built with</text>
                  <text size="small" weight="bold" color="#ff6600">Bolt.new</text>
                  <text size="small">⚡</text>
                </hstack>
              </vstack>
            ),
          });
          context.ui.showToast({ text: '🏃‍♂️ Runnit game created! Ready to race! 🏃‍♂️' });
          context.ui.navigateTo(post);
        }), { _, e: JSON.stringify(context) });
    }
    catch (error) {
      console.log(error);
      context.ui.showToast('Failed to create Runnit game.');
    }
  },
});