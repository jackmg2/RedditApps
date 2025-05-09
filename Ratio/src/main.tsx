// Visit developers.reddit.com/docs to learn Devvit!

import { Devvit, JSONObject, BaseContext, TriggerContext, FormOnSubmitEvent } from '@devvit/public-api';
import { AppSettings } from './types/AppSettings.js';
import { PostRecord } from './types/PostRecord.js';

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
  {
    type: 'paragraph',
    name: 'wrongFlairComment',
    label: 'Comment after modifying a wrong flair',
    defaultValue: '',
  }
]);

Devvit.addTrigger({
  event: 'PostSubmit',
  async onEvent(event, context) {
    const settings = await context.settings.getAll() as AppSettings;
    const post = event.post;
    if (post != null) {
      const userId = post.authorId;
      const user = await context.reddit.getUserById(userId);
      const username = user?.username || "unknown";

      // Get current post counts
      const [regular, monitored] = ((await context.redis.get(userId)) ?? "0/1").split('/').map(Number);
      let regularPosts = regular;
      let monitoredPosts = monitored;

      // Check if this post has the monitored flair
      const monitoredFlairs = settings.monitoredFlair
        .split(';')
        .map(flair => flair.trim())
        .filter(flair => flair.length > 0);
      const isMonitoredFlair = post.linkFlair?.text !== undefined &&
        monitoredFlairs.includes(post.linkFlair.text);

      // Calculate potential new counts
      const newRegularPosts = isMonitoredFlair ? regularPosts : regularPosts + 1;
      const newMonitoredPosts = isMonitoredFlair ? monitoredPosts + 1 : monitoredPosts;

      // Check if the new ratio would violate the rules
      const wouldViolateRatio = newRegularPosts > settings.ratioValue * newMonitoredPosts;

      if (wouldViolateRatio) {
        // Add violation comment
        if (settings.ratioViolationComment != '') {
          const commentResponse = await context.reddit.submitComment({
            id: post.id,
            text: settings.ratioViolationComment
          });
          commentResponse.distinguish(true);
        }

        // Remove post
        await context.reddit.remove(post.id, false);
        
        // Do NOT update the user's ratio since the post is being removed
        return;
      }

      // Only update the ratio and record the post if it wasn't removed
      try {
        await ModifyOldRatio(newRegularPosts, newMonitoredPosts, context, userId);

        // Record post for wiki tracking
        const newRatio = `${newRegularPosts}/${newMonitoredPosts}`;
        await recordPost(context, {
          authorName: username,
          date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
          postTitle: post.title || "Untitled",
          postLink: `https://www.reddit.com${post.permalink}`,
          ratio: newRatio
        });
      } catch (error) {
        console.error('Error updating user flair:', error);
      }
    }
  }
});

// This function is now only used for the menu item functionality
const removeIfNegativeRatio = async (numberOfRegularPosts: number, numberOfMonitoredPosts: number, postId: string, settings: AppSettings, context: TriggerContext) => {
  // Check ratio (regular posts should not exceed ratioValue times monitored posts)
  if (numberOfRegularPosts > settings.ratioValue * numberOfMonitoredPosts) {
    // Add violation comment
    if (settings.ratioViolationComment != '') {
      const commentResponse = await context.reddit.submitComment({
        id: postId,
        text: settings.ratioViolationComment
      });
      commentResponse.distinguish(true);
    }

    // Remove post
    await context.reddit.remove(postId, false);
    return true; // Post was removed
  }
  return false; // Post was not removed
}

const onManualRatioModificationHandler = async (event: FormOnSubmitEvent<JSONObject>, context: Devvit.Context) => {
  const { userId, regularCount, monitoredCount, currentFlair } = event.values;

  try {
    await ModifyOldRatio(regularCount, monitoredCount, context, userId);
    context.ui.showToast(`User ratio modified, please refresh.`);
  } catch (error) {
    if (error instanceof Error) {
      context.ui.showToast(`An error occurred: ${error.message}`);
    }
  }
}

const manualRatioModificationModal = Devvit.createForm((data) => ({
  title: `Manually modify ratio`,
  fields: [
    {
      name: 'userId',
      label: 'User Id',
      type: 'string',
      disabled: true,
      defaultValue: data.userId
    },
    {
      name: 'regularCount',
      label: 'Usual Posts',
      type: 'number',
      disabled: false,
      defaultValue: data.regularPosts
    },
    {
      name: 'monitoredCount',
      label: 'Monitored Flair',
      type: 'number',
      disabled: false,
      defaultValue: data.monitoredPosts
    }
  ],
  acceptLabel: 'Submit',
  cancelLabel: 'Cancel',
}), onManualRatioModificationHandler);

Devvit.addMenuItem({
  location: 'post',
  forUserType: 'moderator',
  label: 'Ratio: Manually set user ratio',
  onPress: async (event, context) => {
    const post = await context.reddit.getPostById(context.postId as string);
    const userId = post.authorId as `t2_${string}`;
    const [regular, monitored] = ((await context.redis.get(userId)) ?? "0/1").split('/').map(Number);
    let regularPosts = regular;
    let monitoredPosts = monitored;
    const user = await context.reddit.getUserById(userId);
    if (user) {
      context.ui.showForm(manualRatioModificationModal, {
        username: user.username,
        userId: user.id,
        regularPosts: regularPosts,
        monitoredPosts: monitoredPosts
      });
    }
  }
});

const onChangeFlairAndRatioModalHandler = async (event: FormOnSubmitEvent<JSONObject>, context: Devvit.Context) => {
  const { userId, currentPostFlair, newPostFlair, postId } = event.values;
  const selectedPostFlair = newPostFlair;  
  updateFlairAndRatio(context, userId as string, currentPostFlair as string, selectedPostFlair as string, postId as string);
}

const changeFlairAndRatioModal = Devvit.createForm((data) => ({
  title: `Manually modify ratio for ${data.username}`,
  fields: [
    {
      name: 'postId',
      label: 'Post Id',
      type: 'string',
      disabled: true,
      defaultValue: data.postId
    },
    {
      name: 'userId',
      label: 'User Id',
      type: 'string',
      disabled: true,
      defaultValue: data.userId
    },
    {
      name: 'currentPostFlair',
      label: 'Current Post Flair',
      type: 'string',
      disabled: true,
      defaultValue: data.currentSelectedPostFlair
    },
    {
      name: 'newPostFlair',
      label: 'New Flair',
      type: 'select',
      disabled: false,
      options: data.possibleFlairs,
      multiSelect: false
    }
  ],
  acceptLabel: 'Submit',
  cancelLabel: 'Cancel',
}), onChangeFlairAndRatioModalHandler);

Devvit.addMenuItem({
  location: 'post',
  forUserType: 'moderator',
  label: 'Ratio: Change flair and update ratio',
  onPress: async (event, context) => {
    const post = await context.reddit.getPostById(context.postId as string);
    const userId = post.authorId as `t2_${string}`;

    const user = await context.reddit.getUserById(userId);

    if (user) {
      const settings = await context.settings.getAll() as AppSettings;
      const possibleFlairs = settings.monitoredFlair
        .split(';')
        .map(flair => flair.trim())
        .filter(flair => flair.length > 0)
        .map(flair => ({ label: flair, value: flair }));

      possibleFlairs.push(({ label: 'No flair', value: '' }));

      context.ui.showForm(changeFlairAndRatioModal, {
        userId: user.id,
        username: user.username,
        possibleFlairs: possibleFlairs,
        currentSelectedPostFlair: post.flair?.text ?? 'No flair',
        postId: context.postId as string
      });
    }
  }
});

// New "Remove flair" menu item
Devvit.addMenuItem({
  location: 'post',
  forUserType: 'moderator',
  label: 'Ratio: Remove flair',
  onPress: async (event, context) => {
    const post = await context.reddit.getPostById(context.postId as string);
    const userId = post.authorId as `t2_${string}`;
    const currentPostFlair = post.flair?.text;

    // Only proceed if the post has a flair
    if (!currentPostFlair) {
      context.ui.showToast('This post does not have a flair to remove.');
      return;
    }

    updateFlairAndRatio(context, userId, currentPostFlair, '', context.postId as string);
  }
});

// Add a menu item to manually update the wiki
Devvit.addMenuItem({
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'Ratio: Refresh Wiki',
  onPress: async (event, context) => {
    try {
      // Get posts from Redis
      const postsJson = await context.redis.get('posts') as string;
      const posts: PostRecord[] = postsJson ? JSON.parse(postsJson) : [];

      if (posts.length === 0) {
        context.ui.showToast('No post records found to update wiki.');
        return;
      }

      // Update wiki
      await updateWikiPage(context, posts);
      context.ui.showToast('RedditRatio wiki page updated successfully.');
    } catch (error) {
      if (error instanceof Error) {
        context.ui.showToast(`Error updating wiki: ${error.message}`);
      } else {
        context.ui.showToast('An unknown error occurred while updating the wiki.');
      }
    }
  }
});

// Add a menu item to manually set ratio for any user by username
const onSetUserRatioByUsernameHandler = async (event: FormOnSubmitEvent<JSONObject>, context: Devvit.Context) => {
  const { username, regularCount, monitoredCount } = event.values;
  
  try {
    // Convert string username to user ID
    const user = await context.reddit.getUserByUsername(username as string);
    
    if (!user) {
      context.ui.showToast(`User ${username} not found.`);
      return;
    }
    
    // Update the user's ratio
    await ModifyOldRatio(regularCount, monitoredCount, context, user.id);
    
    // Add a record to the wiki
    const newRatio = `${regularCount}/${monitoredCount}`;
    await recordPost(context, {
      authorName: username as string,
      date: new Date().toISOString().split('T')[0],
      postTitle: `[MANUAL ADJUSTMENT]`,
      postLink: `https://www.reddit.com/r/${(await context.reddit.getCurrentSubreddit()).name}`,
      ratio: newRatio
    });
    
    context.ui.showToast(`Ratio for ${username} has been set to ${newRatio}.`);
  } catch (error) {
    if (error instanceof Error) {
      context.ui.showToast(`An error occurred: ${error.message}`);
    } else {
      context.ui.showToast('An unknown error occurred while setting the ratio.');
    }
  }
}

const setUserRatioByUsernameModal = Devvit.createForm(() => ({
  title: `Set ratio by username`,
  fields: [
    {
      name: 'username',
      label: 'Username',
      type: 'string',
      required: true
    },
    {
      name: 'regularCount',
      label: 'Regular Posts',
      type: 'number',
      defaultValue: 0,
      required: true
    },
    {
      name: 'monitoredCount',
      label: 'Monitored Posts',
      type: 'number',
      defaultValue: 1,
      required: true
    }
  ],
  acceptLabel: 'Set Ratio',
  cancelLabel: 'Cancel',
}), onSetUserRatioByUsernameHandler);

// Add menu item to subreddit menu
Devvit.addMenuItem({
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'Ratio: Set User Ratio by Username',
  onPress: async (event, context) => {
    context.ui.showForm(setUserRatioByUsernameModal);
  }
});

// Add trigger for post deletion
Devvit.addTrigger({
  event: 'PostDelete',
  async onEvent(event, context) {
    const post = event.postId ? await context.reddit.getPostById(event.postId) : null;
    if (post != null) {
      console.log('Post deleted:', post.id);
      console.log('Post author:', event.author?.id);
      const userId = event.author?.id as string;
      const user = await context.reddit.getUserById(userId);
      
      if (!user) {
        console.error('Could not find user for deleted post');
        return;
      }

      // Get current ratio
      const [regular, monitored] = ((await context.redis.get(userId)) ?? "0/1").split('/').map(Number);
      let regularPosts = regular;
      let monitoredPosts = monitored;

      // Check if this post had a monitored flair
      const settings = await context.settings.getAll() as AppSettings;
      const monitoredFlairs = settings.monitoredFlair
        .split(';')
        .map(flair => flair.trim())
        .filter(flair => flair.length > 0);
      
      const wasMonitoredFlair = post.flair?.text !== undefined &&
        monitoredFlairs.includes(post.flair.text);

      // Update counts based on the deleted post's flair
      if (wasMonitoredFlair) {
        monitoredPosts = Math.max(0, monitoredPosts - 1); // Ensure we don't go below 0
      } else {
        regularPosts = Math.max(0, regularPosts - 1); // Ensure we don't go below 0
      }

      // Update the user's ratio
      try {
        await ModifyOldRatio(regularPosts, monitoredPosts, context, userId);
        
        // Add a record to the wiki about the post deletion
        const username = user.username || "unknown";
        const newRatio = `${regularPosts}/${monitoredPosts}`;
        await recordPost(context, {
          authorName: username,
          date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
          postTitle: post.title ? `[DELETED] ${post.title}` : "[DELETED POST]",
          postLink: `https://www.reddit.com${post.permalink}`,
          ratio: newRatio
        });
      } catch (error) {
        console.error('Error updating user flair after post deletion:', error);
      }
    }
  }
});

// Configure Devvit
Devvit.configure({
  redditAPI: true,
  redis: true
});

export default Devvit;

async function updateFlairAndRatio(context: Devvit.Context, userId: string, currentPostFlair: string, selectedPostFlair: string, postId: string){
  try {
    const [regular, monitored] = ((await context.redis.get(userId as string)) ?? "0/1").split('/').map(Number);
    let regularPosts = regular;
    let monitoredPosts = monitored;

    const settings = await context.settings.getAll() as AppSettings;
    const monitoredFlairs = settings.monitoredFlair
      .split(';')
      .map(flair => flair.trim())
      .filter(flair => flair.length > 0);

    const wasMonitored = monitoredFlairs.some(f => f == currentPostFlair);
    const isNowMonitored = monitoredFlairs.some(f => f == selectedPostFlair);

    if (!wasMonitored && isNowMonitored) {
      regularPosts--;
      monitoredPosts++;
    }
    else if (wasMonitored && !isNowMonitored) {
      regularPosts++;
      monitoredPosts--;

      if (settings.wrongFlairComment != '') {
        const commentResponse = await context.reddit.submitComment({
          id: postId as string,
          text: settings.wrongFlairComment
        });
        commentResponse.distinguish(true);
      }
    }

    // Update subreddit flair first
    const subReddit = await context.reddit.getCurrentSubreddit();
    const subRedditName = subReddit.name;
    if (selectedPostFlair == '') {
      await context.reddit.removePostFlair(subReddit.name, postId as string);
    }
    else {
      const flairTemplates = await context.reddit.getPostFlairTemplates(subReddit.name);
      const correspondingFlairTemplate = flairTemplates.find(f => f.text == selectedPostFlair);

      await context.reddit.setPostFlair({
        subredditName: subRedditName,
        postId: postId as string,
        flairTemplateId: correspondingFlairTemplate?.id,
        text: correspondingFlairTemplate?.text,
        backgroundColor: correspondingFlairTemplate?.backgroundColor,
        textColor: correspondingFlairTemplate?.textColor,
      });
    }
    
    // Check if the post would violate ratio rules with the new flair
    const wasRemoved = await removeIfNegativeRatio(regularPosts, monitoredPosts, postId as string, settings, context);
    
    // Only update the user's ratio if the post wasn't removed
    if (!wasRemoved) {
      await ModifyOldRatio(regularPosts, monitoredPosts, context, userId);
      context.ui.showToast(`Post flair ${selectedPostFlair === '' ? 'removed' : 'modified'}, please refresh.`);
    } else {
      context.ui.showToast(`Post flair modified but post was removed due to ratio violation.`);
    }
  } catch (error) {
    if (error instanceof Error && error.message) {
      context.ui.showToast(`An error occurred: ${error.message}`);
    } else {
      // Handle case when error doesn't have a message or isn't an Error object
      context.ui.showToast('An unknown error occurred while updating the flair.');
    }
  }
}

async function ModifyOldRatio(regularPosts: any, monitoredPosts: any, context: TriggerContext, userId: any) {
  const ratio = `[${regularPosts}/${monitoredPosts}]`;
  const subReddit = await context.reddit.getCurrentSubreddit();
  const subRedditName = subReddit.name;
  const user = await context.reddit.getUserById(userId);
  const username = user?.username as string;
  const currentUserFlair = await subReddit.getUserFlair({ usernames: [username] });

  if (currentUserFlair && currentUserFlair.users.length > 0) {
    let newFlairText = currentUserFlair?.users[0].flairText || '';

    // Remove old ratio if it exists
    newFlairText = newFlairText.replace(/\[\d+\/\d+\]$/, '').trim();

    // Add new ratio
    newFlairText = `${newFlairText} ${ratio}`.trim();
    try {
      await context.reddit.setUserFlair({
        subredditName: subRedditName,
        username: username,
        cssClass: currentUserFlair?.users[0].flairCssClass || '',
        text: newFlairText
      });

      // Update counts in Redis
      await context.redis.set(userId, `${regularPosts}/${monitoredPosts}`);
    }
    catch (error) {
      console.log(`Error: ${error}`);
    }
    console.log(`New flair ${newFlairText} for ${username} in ${subRedditName}`);
  }
}

// Function to record a post in Redis and update the wiki
async function recordPost(context: TriggerContext, postRecord: PostRecord) {
  try {
    // Get existing posts from Redis
    const existingPostsJson = await context.redis.get('posts') as string;
    const posts: PostRecord[] = existingPostsJson ? JSON.parse(existingPostsJson) : [];

    // Add new post record
    posts.push(postRecord);

    // Store updated posts in Redis
    await context.redis.set('posts', JSON.stringify(posts));

    // Update wiki page
    await updateWikiPage(context, posts);
  } catch (error) {
    console.error('Error recording post:', error);
  }
}

// Function to update the wiki page with post records
async function updateWikiPage(context: TriggerContext, posts: PostRecord[]) {
  try {
    const subredditName = (await context.reddit.getCurrentSubreddit()).name;
    const wikiPageName = 'redditratio';

    // Group posts by author
    const postsByAuthor: Record<string, PostRecord[]> = {};

    posts.forEach(post => {
      if (!postsByAuthor[post.authorName]) {
        postsByAuthor[post.authorName] = [];
      }
      postsByAuthor[post.authorName].push(post);
    });

    // Create wiki content
    let wikiContent = '# Post History by User\n\n';
    wikiContent += 'This page is automatically generated and tracks all posts with their ratio changes.\n\n';

    // Sort authors alphabetically
    const sortedAuthors = Object.keys(postsByAuthor).sort();

    sortedAuthors.forEach(author => {
      wikiContent += `## ${author}\n\n`;

      // Sort posts by date descending (newest first)
      const sortedPosts = postsByAuthor[author].sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      sortedPosts.forEach(post => {
        wikiContent += `* ${post.date}: [${post.postTitle}](${post.postLink}) - Ratio: ${post.ratio}\n`;
      });

      wikiContent += '\n';
    });

    // Update the wiki page with moderator-only permissions
    try {
      // First check if the page exists
      let pageExists = false;
      try {
        await context.reddit.getWikiPage(subredditName, wikiPageName);
        pageExists = true;
      } catch (error) {
        // Page doesn't exist yet, which is fine
        pageExists = false;
      }

      if (pageExists) {
        // Update or create page
        await context.reddit.updateWikiPage({
          subredditName: subredditName,
          page: wikiPageName,
          content: wikiContent,
          reason: 'Automatic update by RedditRatio'
        });
      }

      // If page is new, set it to moderator-only
      if (!pageExists) {
        let wikipage = await context.reddit.createWikiPage({
          subredditName: subredditName,
          page: wikiPageName,
          content: wikiContent,
          reason: 'Automatic creation by RedditRatio'
        });
      }
    } catch (error) {
      console.error('Error updating wiki page:', error);
    }
  } catch (error) {
    console.error('Error in updateWikiPage:', error);
  }
}