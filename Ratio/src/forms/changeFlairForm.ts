import { Devvit, FormOnSubmitEvent, JSONObject } from '@devvit/public-api';
import { FlairService } from '../services/flairService.js';

export const onChangeFlairAndRatioModalHandler = async (
  event: FormOnSubmitEvent<JSONObject>, 
  context: Devvit.Context
) => {
  try {
    const { userId, currentPostFlair, newPostFlair, postId } = event.values;
    
    // Add validation
    if (!userId || !postId) {
      context.ui.showToast('Missing required data (userId or postId)');
      return;
    }
    
    const selectedPostFlair = (newPostFlair != undefined && (newPostFlair as string[]).length>0) ? (newPostFlair as string[])[0] : '';
    
    console.log(`Form submission - UserID: ${userId}, PostID: ${postId}, Current: "${currentPostFlair}", New: "${selectedPostFlair}"`);
    
    await FlairService.updateFlairAndRatio(
      context, 
      userId as string, 
      currentPostFlair as string, 
      selectedPostFlair, 
      postId as string
    );
  } catch (error) {
    console.error(`Error in form handler: ${error}`);
    context.ui.showToast(`Error processing form: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const changeFlairAndRatioModal = Devvit.createForm((data) => ({
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