import { Devvit, FormOnSubmitEvent, JSONObject } from '@devvit/public-api';
import { RatioService } from '../services/ratioService.js';

export const onManualRatioModificationHandler = async (
  event: FormOnSubmitEvent<JSONObject>, 
  context: Devvit.Context
) => {
const userId = String(event.values.userId);
const regularCount = Number(event.values.regularCount);
const monitoredCount = Number(event.values.monitoredCount);

  try {
    await RatioService.updateUserRatio(regularCount, monitoredCount, userId, context);
    context.ui.showToast(`User ratio modified, please refresh.`);
  } catch (error) {
    if (error instanceof Error) {
      context.ui.showToast(`An error occurred: ${error.message}`);
    }
  }
};

export const manualRatioModificationModal = Devvit.createForm((data) => ({
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