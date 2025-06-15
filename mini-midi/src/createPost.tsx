import { Devvit } from '@devvit/public-api';

// Adds a new menu item to the subreddit allowing to create a new post
Devvit.addMenuItem({
  label: '🎵 Create Silly MIDI Grid Post',
  location: 'subreddit',
  onPress: async (_event, context) => {
    const { reddit, ui } = context;
    const subreddit = await reddit.getCurrentSubreddit();
    const post = await reddit.submitPost({
      title: '🎹 Silly MIDI Grid - Make Gloriously Useless Music! 🎪',
      subredditName: subreddit.name,
      // The preview appears while the post loads
      preview: (
        <vstack height="100%" width="100%" alignment="middle center" gap="medium">
          <text size="xxlarge">🎵</text>
          <text size="large" weight="bold">Loading Silly MIDI Grid...</text>
          <text size="medium" color="secondary">Preparing maximum musical chaos!</text>
          <text size="small">🌈 🎹 🎪 🎵 🌈</text>
        </vstack>
      ),
    });
    ui.showToast({ text: '🎵 Created silly music post! Ready for upvotes! 🎵' });
    ui.navigateTo(post);
  },
});