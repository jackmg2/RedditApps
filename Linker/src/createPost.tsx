import { Devvit } from '@devvit/public-api';

// Adds a new menu item to the subreddit allowing to create a new post
Devvit.addMenuItem({
    label: 'Create Links Board',
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
                            defaultValue: 'Community Links',
                            onValidate: (e: any) => e.value === '' ? 'Title required' : undefined
                        }
                    ],
                    title: 'New Community Links Post',
                    acceptLabel: 'Save',
                },
                async (event, context) => {
                    const subreddit = await context.reddit.getCurrentSubreddit();
                    const post = await context.reddit.submitPost({
                        title: event.values.title,
                        subredditName: subreddit.name,
                        preview: <text size="large">Loading Community Links...</text>
                    });
                    context.ui.showToast('Links board created.');
                    context.ui.navigateTo(post);
                }));
        }
        catch (error) {
            console.log(error);
            context.ui.showToast('Failed to create links board');
        }
    },
});