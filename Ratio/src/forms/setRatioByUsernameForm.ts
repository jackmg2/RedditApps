import { Devvit, FormOnSubmitEvent, JSONObject } from '@devvit/public-api';
import { RatioService } from '../services/ratioService.js';
import { WikiService } from '../services/wikiService.js';

export const onSetUserRatioByUsernameHandler = async (
  event: FormOnSubmitEvent<JSONObject>, 
  context: Devvit.Context
) => {
  const { username, regularCount, monitoredCount } = event.values;
  
  try {
    // Convert string username to user ID
    const user = await context.reddit.getUserByUsername(username as string);
    
    if (!user) {
      context.ui.showToast(`User ${username} not found.`);
      return;
    }
    
    // Update the user's ratio
    await RatioService.updateUserRatio(
      regularCount as number, 
      monitoredCount as number, 
      user.id, 
      context
    );
    
    // Add a record to the wiki (display good posts first)
    const newRatio = `${monitoredCount}/${regularCount}`;
    await WikiService.recordPost(context, {
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
};

export const setUserRatioByUsernameModal = Devvit.createForm(() => ({
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