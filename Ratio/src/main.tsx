// Visit developers.reddit.com/docs to learn Devvit!

import { Devvit } from '@devvit/public-api';
import { AppSettings } from './types/AppSettings.js';

Devvit.addSettings([
  {
    type: 'number',
    name: 'ratioValue',
    label: 'Ratio value, for one tracked post, you can do x other posts.',
    defaultValue: 3,
  },
  {
    type: 'string',
    name: 'monitoredFlair',
    label: 'Tracked post flair, you can add multiple with a semicolon.',
    defaultValue: 'Your post flair;Your second post flair',
  },
  {
    type: 'paragraph',
    name: 'ratioViolationComment',
    label: 'Comment for ratio violation',
    defaultValue: 'Your post has been removed due to exceeding the allowed post ratio.',
  },
]);

Devvit.addTrigger({
  event: 'PostSubmit',
  async onEvent(event, context) {
    const settings = await context.settings.getAll() as AppSettings;
    const post = event.post;
    if (post != null) {
      const userId = post.authorId;

      // Get current post counts
      const [regular, monitored] = ((await context.redis.get(userId)) ?? "0/0").split('/').map(Number);
      let regularPosts = regular;
      let monitoredPosts = monitored;

      // Check if this post has the monitored flair
      const monitoredFlairs = settings.monitoredFlair
                                      .split(';')
                                      .map(flair => flair.trim())
                                      .filter(flair => flair.length > 0);
      const isMonitoredFlair = post.linkFlair?.text !== undefined && 
                                    monitoredFlairs.includes(post.linkFlair.text);
      const ratioValue = settings.ratioValue

      // Calculate new counts
      const newRegularPosts = isMonitoredFlair ? regularPosts : regularPosts + 1;
      const newMonitoredPosts = isMonitoredFlair ? monitoredPosts + 1 : monitoredPosts;

      // Check ratio (regular posts should not exceed ratioValue times monitored posts)
      if (newRegularPosts > ratioValue * newMonitoredPosts) {
        // Remove post
        await context.reddit.remove(post.id, false);

        // Add violation comment
        await context.reddit.submitComment({
          id: post.id,
          text: settings.ratioViolationComment
        });

        return;
      }

      // Update counts in Redis
      await context.redis.set(userId, `${newRegularPosts}/${newMonitoredPosts}`);

      // Update user flair to include ratio
      try {
        const subreddit = await context.reddit.getCurrentSubreddit();
        const user = await context.reddit.getUserById(userId);
        if (user) {
          const currentFlair = await subreddit.getUserFlair({ usernames: [user.username] });
          const ratio = `[${newRegularPosts}/${newMonitoredPosts}]`;
          if (currentFlair && currentFlair.users.length > 0) {
            let newFlairText = currentFlair?.users[0].flairText || '';

            // Remove old ratio if it exists
            newFlairText = newFlairText.replace(/\[\d+\/\d+\]$/, '').trim();

            // Add new ratio
            newFlairText = `${newFlairText} ${ratio}`.trim();

            await context.reddit.setUserFlair({subredditName: subreddit.name, 
              username: user.username, 
              cssClass: currentFlair?.users[0].flairCssClass || '', 
              text: newFlairText});
          }
        }
      } catch (error) {
        console.error('Error updating user flair:', error);
      }
    }
  },
});

// Configure Devvit
Devvit.configure({
  redditAPI: true,
  redis: true
});

export default Devvit;
