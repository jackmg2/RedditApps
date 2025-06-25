import { Devvit } from '@devvit/public-api';

// Adds a new menu item to the subreddit allowing to create a new post
Devvit.addMenuItem({
  label: '🎵 Create MIDI Silly Fantasy Post',
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
              defaultValue: '🎹 MIDI Silly Fantasy - Make Gloriously Useless Music! 🎪',
              onValidate: (e: any) => e.value === '' ? 'Title required' : undefined
            }
          ],
          title: '🎵 Create MIDI Silly Fantasy Post',
          acceptLabel: 'Save',
        },
        async (event, context) => {
          const subreddit = await context.reddit.getCurrentSubreddit();
          const post = await context.reddit.submitPost({
            title: event.values.title,
            subredditName: subreddit.name,
            preview: (
              <vstack height="100%" width="100%" alignment="middle center" gap="medium">
                <text size="xxlarge">🎵</text>
                <text size="large" weight="bold">Loading MIDI Silly Fantasy...</text>
                <text size="medium" color="secondary">Preparing maximum musical chaos!</text>
                <text size="small">🌈 🎹 🎪 🎵 🌈</text>
                <hstack gap="small" alignment="center middle">
                  <text size="small" color="secondary">Built with</text>
                  <text size="small" weight="bold" color="#ff6600">Bolt.new</text>
                  <text size="small">⚡</text>
                </hstack>
              </vstack>
            ),
          });
          context.ui.showToast({ text: '🎵 Created silly music post! Ready for upvotes! 🎵' });
          context.ui.navigateTo(post);
        }), { _, e: JSON.stringify(context) });
    }
    catch (error) {
      console.log(error);
      context.ui.showToast('Failed to create MIDI Silly Fantasy Post.');
    }

  },
});