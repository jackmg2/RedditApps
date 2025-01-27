import { Devvit, JSONObject, FormOnSubmitEvent, RemovalReason, User } from '@devvit/public-api';
import { BanEvent } from './types/banEvent.js'

//Configuration
Devvit.configure({
  redditAPI: true,
  http: false
});

//Nuke posts and comments from this user
async function removeUserContent(username: string, subredditName: string, context: Devvit.Context, markAsSpam: boolean, timePeriod: string) {
  const getPosts = (context: Devvit.Context, username: string) =>
    context.reddit.getPostsByUser({ username }).all();

  const getComments = (context: Devvit.Context, username: string) =>
    context.reddit.getCommentsByUser({ username }).all();

  const filterBySubredditAndTime = (items: any[], subredditName: string, timePeriod: string) => {
    const now = Date.now();
    const timeFilters = {
      'last 24 hours': 86400000,
      'previous 3 days': 259200000,
      'previous 7 days': 604800000,
      'all time': Infinity
    };
    const timeLimit = timeFilters[timePeriod as keyof typeof timeFilters];

    return items.filter(item =>
      item.subredditName === subredditName &&
      (now - new Date(item.createdAt).getTime()) <= timeLimit
    );
  };

  const removeItems = (context: Devvit.Context, items: any[], markAsSpam: boolean) =>
    items.map(item => context.reddit.remove(item.id, markAsSpam))

  // Get posts and comments in parallel
  const [allPosts, allComments] = await Promise.all([
    getPosts(context, username),
    getComments(context, username)
  ]);

  // Filter posts and comments by subreddit and time
  const postsToRemove = filterBySubredditAndTime(
    allPosts.map(p => ({ id: p.id, subredditName: p.subredditName, createdAt: p.createdAt })),
    subredditName,
    timePeriod
  );
  const commentsToRemove = filterBySubredditAndTime(
    allComments.map(c => ({ id: c.id, subredditName: c.subredditName, createdAt: c.createdAt })),
    subredditName,
    timePeriod
  );

  // Remove posts and comments in parallel
  await Promise.all([
    ...removeItems(context, postsToRemove, markAsSpam),
    ...removeItems(context, commentsToRemove, markAsSpam)
  ]);
}

//When form is validated, we ban and remove content for the user
const onSubmitHandler = async (event: FormOnSubmitEvent<JSONObject>, context: Devvit.Context) => {
  const banEvent = BanEvent.fromJson(event.values);
  const removeContentString = (banEvent.removeContent === undefined || banEvent.removeContent.length <= 0) ? 'Do not remove' : banEvent.removeContent[0];
  let errorDuringBan = false;
  let errorDuringRemoval = false;

  try {
    // Ban the user
    await context.reddit.banUser({
      subredditName: banEvent.subRedditName,
      username: banEvent.username,
      duration: banEvent.banDuration,
      reason: `${banEvent.ruleViolated}`.substring(0, 100),
      message: banEvent.banMessage,
    });
  }
  catch (error) {
    let errorMessage = `An error happened during ban of ${banEvent.username}: ${error}`;
    console.error(errorMessage);
    context.ui.showToast(errorMessage);
    errorDuringBan = true;
  }

  if (removeContentString !== 'Do not remove') {
    try {
      // Remove user's content from the subreddit based on the selected time period
      await removeUserContent(banEvent.username, banEvent.subRedditName, context, banEvent.markAsSpam, removeContentString);
    }
    catch (error) {
      let errorMessage = `An error happened during ${banEvent.username}'s content removal: ${error}`;
      console.error(errorMessage);
      context.ui.showToast(errorMessage);
      errorDuringRemoval = true;
    }
  }

  if (!errorDuringBan && !errorDuringRemoval) {
    let message = `${banEvent.username} has been banned`;
    let removeContentMessage = '';
    switch (removeContentString) {
      case 'last 24 hours':
        removeContentMessage = ' and their content has been removed for the past 24 hours.';
        break;
      case 'previous 3 days':
        removeContentMessage = ' and their content has been removed for the past 3 days.';
        break;
      case 'previous 7 days':
        removeContentMessage = ' and their content has been removed for the past 7 days.';
        break;
      case 'all time':
        removeContentMessage = ' and all of their content has been removed.';
        break;
      case 'Do not remove':
        removeContentMessage = ' and their content has been kept.';
        break;
    }

    message += removeContentMessage;
    context.ui.showToast(message);
  }
}

const modal = Devvit.createForm((data) => ({
  title: `Ban ${data.username}`,
  fields: [
    {
      name: 'subRedditName',
      label: 'SubReddit',
      type: 'string',
      disabled: true,
      defaultValue: data.subRedditName
    },
    {
      name: 'username',
      label: 'Username',
      type: 'string',
      disabled: true,
      defaultValue: data.username
    },
    {
      type: 'select',
      name: 'banDuration',
      label: 'Ban Duration',
      options: [
        { label: 'Permanent', value: 'permanent' },
        { label: '1 day', value: '1' },
        { label: '3 days', value: '3' },
        { label: '7 days', value: '7' },
        { label: '30 days', value: '30' },
      ],
      defaultValue: ['permanent'],
      multiSelect: false
    },
    {
      name: 'ruleViolated',
      type: 'select',
      label: 'Rule Violated',
      options: data.subredditRules.map((rule: RemovalReason) => ({ label: rule.title, value: rule.message })),
    },
    {
      name: 'banMessage',
      type: 'string',
      label: 'Ban Message',
      placeholder: 'Enter a message to send to the user',
    },
    {
      name: 'removeContent',
      type: 'select',
      label: 'Remove all user\'s content posted',
      options: [
        { label: 'Do not remove', value: 'Do not remove' },
        { label: 'Last 24 hours', value: 'last 24 hours' },
        { label: 'Previous 3 days', value: 'previous 3 days' },
        { label: 'Previous 7 days', value: 'previous 7 days' },
        { label: 'All time', value: 'all time' },
      ],
      defaultValue: ['Do not remove'],
      multiselect: false
    },
    {
      name: 'markAsSpam',
      type: 'boolean',
      label: 'Mark as spam',
    }
  ],
  acceptLabel: 'Submit',
  cancelLabel: 'Cancel',
}), onSubmitHandler);

Devvit.addMenuItem({
  location: ['post', 'comment'],
  label: 'Ban User and Remove Content',
  forUserType: 'moderator',
  onPress: async (event, context) => {
    let authorId = null;

    if (context.postId) {
      const post = await context.reddit.getPostById(context.postId as string);
      authorId = post.authorId;
    }
    else if (context.commentId) {
      const comment = await context.reddit.getCommentById(context.commentId as string);
      authorId = comment.authorId;
    }
    const author = await context.reddit.getUserById(authorId as string) as User;
    const subRedditName = (await context.reddit.getCurrentSubreddit()).name;
    const subredditRules = await context.reddit.getSubredditRemovalReasons(subRedditName);

    await showBanModal(author.username, context, subRedditName, subredditRules);
  },
});

function showBanModal(username: string, context: Devvit.Context, subRedditName: string, subredditRules: RemovalReason[]) {
  context.ui.showForm(modal, { username: username, subRedditName: subRedditName, subredditRules: subredditRules });
}

export default Devvit;