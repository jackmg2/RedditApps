import { Devvit } from '@devvit/public-api';

// Create the form outside the menu item
const createShopPostForm = Devvit.createForm(
    {
        fields: [
            {
                name: 'title',
                label: 'Post Title',
                type: 'string',
                required: true,
                helpText: 'Enter a title for your shop post'
            },
            {
                name: 'image',
                label: 'Product Image',
                type: 'image',
                required: true,
                helpText: 'Upload the first image to add shopping pins to (you can add more images later)'
            }
        ],
        title: 'Create Shop Post',
        acceptLabel: 'Create Post',
    },
    async (event, context) => {
        try {
            const subreddit = await context.reddit.getCurrentSubreddit();
            const currentUser = await context.reddit.getCurrentUser();
            
            if (!currentUser) {
                context.ui.showToast('Error: Could not get current user');
                return;
            }
            
            // Create the post first
            const post = await context.reddit.submitPost({
                title: event.values.title,
                subredditName: subreddit.name,
                preview: (
                    <vstack height="100%" width="100%" alignment="middle center">
                        <text size="large">Loading Shop Post...</text>
                    </vstack>
                ),
            });

            // Store the real author ID separately in Redis
            await context.redis.set(`shop_post_author_${post.id}`, currentUser.id);

            // Save the shop post data to Redis with new multi-image format
            const shopPostData = {
                title: event.values.title,
                images: [
                    {
                        id: Math.random().toString(36).substr(2, 9),
                        url: event.values.image || '',
                        pins: [],
                        createdAt: new Date().toISOString()
                    }
                ],
                createdAt: new Date().toISOString(),
                authorId: currentUser.id, // Store the real author ID here too
                clickTracking: {} // Initialize click tracking
            };

            await context.redis.set(`shop_post_${post.id}`, JSON.stringify(shopPostData));

            context.ui.showToast('Shop post created successfully!');
            context.ui.navigateTo(post);
        } catch (error) {
            console.error('Error creating shop post:', error);
            context.ui.showToast('Failed to create shop post');
        }
    }
);

// Adds a new menu item to the subreddit allowing to create a new shop post
Devvit.addMenuItem({
    label: 'Create Shop Post',
    location: 'subreddit',
    onPress: async (_, context) => {
        try {
            // Check settings to see if all users can create posts
            const settings = await context.settings.getAll();
            const allowAllUsers = settings.allowAllUsers as boolean;
            
            // If not allowing all users, check if user is moderator
            if (!allowAllUsers) {
                const currentUser = await context.reddit.getCurrentUser();
                if (!currentUser) {
                    context.ui.showToast('Please log in to create a shop post');
                    return;
                }
                
                const moderators = await context.reddit.getModerators({ 
                    subredditName: context.subredditName as string 
                });
                const allMods = await moderators.all();
                const isModerator = allMods.some(m => m.username === currentUser.username);
                
                if (!isModerator) {
                    context.ui.showToast('Only moderators can create shop posts');
                    return;
                }
            }

            context.ui.showForm(createShopPostForm);
        }
        catch (error) {
            console.error('Error opening create shop post form:', error);
            context.ui.showToast('Failed to open create shop post form');
        }
    },
});