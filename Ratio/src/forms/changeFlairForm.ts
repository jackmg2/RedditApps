import { Devvit, FormOnSubmitEvent, JSONObject } from '@devvit/public-api';
import { FlairService } from '../services/flairService.js';

export const onChangeFlairAndRatioModalHandler = async (
  event: FormOnSubmitEvent<JSONObject>, 
  context: Devvit.Context
) => {
  const { userId, currentPostFlair, newPostFlair, postId } = event.values;
  const selectedPostFlair = newPostFlair;
  
  await FlairService.updateFlairAndRatio(
    context, 
    userId as string, 
    currentPostFlair as string, 
    selectedPostFlair as string, 
    postId as string
  );
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