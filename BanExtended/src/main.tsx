import { Devvit, JSONObject, FormOnSubmitEvent, RemovalReason, User } from '@devvit/public-api';
import { BanEvent } from './types/banEvent.js'

//Configuration
Devvit.configure({
  redditAPI: true,
  http: false
});

// Add settings for default values
Devvit.addSettings([
  {
    type: 'select',
    name: 'defaultBanDuration',
    label: 'Default Ban Duration',
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
    type: 'select',
    name: 'defaultRemoveContent',
    label: 'Default Content Removal Period',
    options: [
      { label: 'Do not remove', value: 'Do not remove' },
      { label: 'Last 24 hours', value: 'last 24 hours' },
      { label: 'Previous 3 days', value: 'previous 3 days' },
      { label: 'Previous 7 days', value: 'previous 7 days' },
      { label: 'All time', value: 'all time' },
    ],
    defaultValue: ['Do not remove'],
    multiSelect: false
  }
]);

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

// New bulk ban submission handler
const onBulkBanSubmitHandler = async (event: FormOnSubmitEvent<JSONObject>, context: Devvit.Context) => {
  const { subRedditName, usernames, banDuration, ruleViolated, banMessage, removeContent, markAsSpam } = event.values;
  
  // Parse usernames from semicolon-separated string
  const usernameList = (usernames as string)
    .split(';')
    .map(name => name.trim())
    .filter(name => name.length > 0);

  if (usernameList.length === 0) {
    context.ui.showToast('No valid usernames provided');
    return;
  }

  context.ui.showToast(`Processing ${usernameList.length} users...`);

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  const removeContentString = (removeContent === undefined || removeContent.length <= 0) ? 'Do not remove' : removeContent[0];
  const duration = banDuration[0] === 'permanent' ? undefined : parseInt(banDuration[0]);

  // Process each user
  for (const username of usernameList) {
    let errorDuringBan = false;
    let errorDuringRemoval = false;

    try {
      // Ban the user
      await context.reddit.banUser({
        subredditName: subRedditName as string,
        username: username,
        duration: duration,
        reason: `${ruleViolated}`.substring(0, 100),
        message: banMessage as string,
      });
    } catch (error) {
      errorDuringBan = true;
      if (error instanceof Error) {
        errors.push(`${username} (ban): ${error.message}`);
      } else {
        errors.push(`${username} (ban): Unknown error`);
      }
    }

    // Remove content if requested and ban was successful
    if (!errorDuringBan && removeContentString !== 'Do not remove') {
      try {
        await removeUserContent(username, subRedditName as string, context, markAsSpam as boolean, removeContentString);
      } catch (error) {
        errorDuringRemoval = true;
        if (error instanceof Error) {
          errors.push(`${username} (content removal): ${error.message}`);
        } else {
          errors.push(`${username} (content removal): Unknown error`);
        }
      }
    }

    if (!errorDuringBan && !errorDuringRemoval) {
      successCount++;
    } else {
      errorCount++;
    }
  }

  // Show results
  if (successCount > 0) {
    context.ui.showToast(`✅ Successfully processed ${successCount} users`);
  }
  
  if (errorCount > 0) {
    context.ui.showToast(`❌ Failed to process ${errorCount} users`);
    // Show first few errors
    if (errors.length > 0) {
      const errorSummary = errors.slice(0, 3).join('; ');
      context.ui.showToast(`Errors: ${errorSummary}${errors.length > 3 ? '...' : ''}`);
    }
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
      defaultValue: [data.defaultBanDuration],
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
      defaultValue: [data.defaultRemoveContent],
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

// New bulk ban modal
const modalBulkBan = Devvit.createForm((data) => ({
  title: 'Bulk Ban Users',
  fields: [
    {
      name: 'subRedditName',
      label: 'SubReddit',
      type: 'string',
      disabled: true,
      defaultValue: data.subRedditName
    },
    {
      name: 'usernames',
      label: 'Usernames (semicolon-separated)',
      type: 'paragraph',
      helpText: 'Enter usernames separated by semicolons (e.g., user1;user2;user3)',
      required: true
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
      defaultValue: [data.defaultBanDuration],
      multiSelect: false,
      required: true
    },
    {
      name: 'ruleViolated',
      type: 'select',
      label: 'Rule Violated',
      options: data.subredditRules.map((rule: RemovalReason) => ({ label: rule.title, value: rule.message })),
      required: true
    },
    {
      name: 'banMessage',
      type: 'string',
      label: 'Ban Message',
      placeholder: 'Enter a message to send to all users',
    },
    {
      name: 'removeContent',
      type: 'select',
      label: 'Remove all users\' content posted',
      options: [
        { label: 'Do not remove', value: 'Do not remove' },
        { label: 'Last 24 hours', value: 'last 24 hours' },
        { label: 'Previous 3 days', value: 'previous 3 days' },
        { label: 'Previous 7 days', value: 'previous 7 days' },
        { label: 'All time', value: 'all time' },
      ],
      defaultValue: [data.defaultRemoveContent],
      multiSelect: false
    },
    {
      name: 'markAsSpam',
      type: 'boolean',
      label: 'Mark as spam',
    }
  ],
  acceptLabel: 'Ban All Users',
  cancelLabel: 'Cancel',
}), onBulkBanSubmitHandler);

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

    // Get settings values
    const settings = await context.settings.getAll();
    const defaultBanDuration = settings.defaultBanDuration as string || 'permanent';
    const defaultRemoveContent = settings.defaultRemoveContent as string || 'Do not remove';

    await showBanModal(author.username, context, subRedditName, subredditRules, defaultBanDuration, defaultRemoveContent);
  },
});

// New function to handle export of banned users
const handleExportBannedUsers = async (context: Devvit.Context) => {
  try {
    const subRedditName = (await context.reddit.getCurrentSubreddit()).name;
    context.ui.showToast('Fetching banned users...');
    
    // Get banned users from the subreddit
    const bannedUsersListing = await context.reddit.getBannedUsers({ subredditName: subRedditName });
    const bannedUsersArray = await bannedUsersListing.all();

    if (bannedUsersArray.length === 0) {
      context.ui.showToast('No banned users found in this subreddit');
      return;
    }

    // Create semicolon-separated list
    const userList = bannedUsersArray
      .map((user: User) => user.username)
      .join(';');

    // Define the export modal
    const modalExportBannedUsers = Devvit.createForm((data) => ({
      title: `Banned Users (${data.total} total)`,
      fields: [
        {
          name: 'bannedUsersList',
          label: 'Banned Users List',
          type: 'paragraph',
          helpText: 'Copy this semicolon-separated list of banned users',
          defaultValue: data.userList,
          disabled: false
        }
      ],
      acceptLabel: 'Done',
      cancelLabel: 'Close',
    }), async () => {
      // No action needed on submit, just close the form
      context.ui.showToast('Banned users list displayed');
    });

    // Show the list in a form for easy copying
    context.ui.showForm(modalExportBannedUsers, {
      userList: userList,
      total: bannedUsersArray.length
    });

  } catch (error) {
    if (error instanceof Error) {
      context.ui.showToast(`Error fetching banned users: ${error.message}`);
    } else {
      context.ui.showToast('Error fetching banned users');
    }
  }
};

// New function to handle bulk ban import
const handleBulkBanImport = async (context: Devvit.Context) => {
  try {
    const subRedditName = (await context.reddit.getCurrentSubreddit()).name;
    const subredditRules = await context.reddit.getSubredditRemovalReasons(subRedditName);
    
    if (subredditRules.length === 0) {
      context.ui.showToast('No removal reasons available in this subreddit');
      return;
    }

    // Get settings values
    const settings = await context.settings.getAll();
    const defaultBanDuration = settings.defaultBanDuration as string || 'permanent';
    const defaultRemoveContent = settings.defaultRemoveContent as string || 'Do not remove';

    context.ui.showForm(modalBulkBan, {
      subRedditName: subRedditName,
      subredditRules: subredditRules,
      defaultBanDuration: defaultBanDuration,
      defaultRemoveContent: defaultRemoveContent
    });
  } catch (error) {
    if (error instanceof Error) {
      context.ui.showToast(`Error loading bulk ban form: ${error.message}`);
    } else {
      context.ui.showToast('Error loading bulk ban form');
    }
  }
};

// New export banned users menu item
Devvit.addMenuItem({
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'Ban Extended: Export Banned Users',
  onPress: async (event, context) => {
    await handleExportBannedUsers(context);
  }
});

// New bulk ban import menu item
Devvit.addMenuItem({
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'Ban Extended: Bulk Ban Users',
  onPress: async (event, context) => {
    await handleBulkBanImport(context);
  }
});

function showBanModal(username: string, context: Devvit.Context, subRedditName: string, subredditRules: RemovalReason[], defaultBanDuration: string, defaultRemoveContent: string) {
  context.ui.showForm(modal, { 
    username: username, 
    subRedditName: subRedditName, 
    subredditRules: subredditRules,
    defaultBanDuration: defaultBanDuration,
    defaultRemoveContent: defaultRemoveContent
  });
}

export default Devvit;