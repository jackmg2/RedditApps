// Visit developers.reddit.com/docs to learn Devvit!

import { Devvit, JSONObject, BaseContext, TriggerContext, FormOnSubmitEvent } from '@devvit/public-api';
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

      // Calculate new counts
      const newRegularPosts = isMonitoredFlair ? regularPosts : regularPosts + 1;
      const newMonitoredPosts = isMonitoredFlair ? monitoredPosts + 1 : monitoredPosts;      

      // Check ratio (regular posts should not exceed ratioValue times monitored posts)
      removeIfNegativeRatio(newRegularPosts, newMonitoredPosts, post.id, settings, context);

      // Update Redis and user flair to include ratio
      try {
        await ModifyOldRatio(newRegularPosts, newMonitoredPosts, context, userId);
      } catch (error) {
        console.error('Error updating user flair:', error);
      }
    }
  }
});

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
  }
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
  label: 'Manually set user ratio',
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

    await ModifyOldRatio(regularPosts, monitoredPosts, context, userId);

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
    removeIfNegativeRatio(regularPosts, monitoredPosts, postId as string, settings, context);
    context.ui.showToast(`Post flair modified, please refresh.`);
  } catch (error) {
    if (error instanceof Error) {
      context.ui.showToast(`An error occurred: ${error.message}`);
    }
  }
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
  label: 'Change flair and update ratio',
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

// Configure Devvit
Devvit.configure({
  redditAPI: true,
  redis: true
});

export default Devvit;


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

