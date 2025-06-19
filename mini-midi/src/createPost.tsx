import { Devvit } from '@devvit/public-api';

// Adds a new menu item to the subreddit allowing to create a new post
Devvit.addMenuItem({
  label: '🎵 Create MIDI Silly Fantasy',
  location: 'subreddit',
  onPress: async (_event, context) => {
    const { reddit, ui } = context;
    const subreddit = await reddit.getCurrentSubreddit();
    const post = await reddit.submitPost({
      title: '🎹 MIDI Silly Fantasy - Make Gloriously Useless Music! 🎪',
      subredditName: subreddit.name,
      // The preview appears while the post loads
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
    ui.showToast({ text: '🎵 Created silly music post! Ready for upvotes! 🎵' });
    ui.navigateTo(post);
  },
});