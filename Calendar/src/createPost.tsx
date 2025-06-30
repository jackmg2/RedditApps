import { Devvit } from '@devvit/public-api';

// Adds a new menu item to the subreddit allowing to create a new post
Devvit.addMenuItem({
    label: 'Create Community Calendar',
    location: 'subreddit',
    forUserType: 'moderator',
    onPress: async (_, context) => {
        try {
            context.ui.showForm(Devvit.createForm(
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
                        preview: (
                            <vstack height="100%" width="100%" alignment="middle center">
                                <text size="large">Loading Community Calendar...</text>
                            </vstack>
                        ),
                    });
                    context.ui.showToast({ text: 'Created Community Calendar post! Please refresh.' });
                    context.ui.navigateTo(post);
                }), { _, e: JSON.stringify(context) });
        }
        catch (error) {
            console.log(error);
            context.ui.showToast('Failed to create calendar.');
        }

    },
});