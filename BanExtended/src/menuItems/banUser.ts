import { MenuItem, User } from '@devvit/public-api';
import { AppSettings } from '../types/appSettings.js';
import { modalBanUser } from '../forms/banUserForm.js';

export const banUserMenuItem: MenuItem = {
  location: ['post', 'comment'],
  label: 'Ban User and Remove Content',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    let authorId = null;

    if (context.postId) {
      const post = await context.reddit.getPostById(context.postId as string);
      authorId = post.authorId;
    } else if (context.commentId) {
      const comment = await context.reddit.getCommentById(context.commentId as string);
      authorId = comment.authorId;
    }

    const author = await context.reddit.getUserById(authorId as string) as User;
    const subRedditName = (await context.reddit.getCurrentSubreddit()).name;
    const subredditRules = await context.reddit.getSubredditRemovalReasons(subRedditName);

    // Get settings values
    const settings = await context.settings.getAll() as AppSettings;
    const defaultBanDuration = settings.defaultBanDuration || 'permanent';
    const defaultRemoveContent = settings.defaultRemoveContent || 'Do not remove';

    context.ui.showForm(modalBanUser, {
      username: author.username,
      subRedditName: subRedditName,
      subredditRules: subredditRules.map(rule => ({ 
        label: rule.title, 
        value: rule.message 
      })),
      defaultBanDuration: defaultBanDuration,
      defaultRemoveContent: defaultRemoveContent
    });
  },
};