import { Devvit, FormOnSubmitEvent, JSONObject } from '@devvit/public-api';
import { EventService } from '../services/eventService.js';

export const createBackgroundImageForm = (data: any) => Devvit.createForm(
  () => {
    return {
      fields: [
        {
          name: 'backgroundImage',
          label: 'Background Image',
          type: 'image',
          defaultValue: data.currentImage || '',
          helpText: 'Upload an image for the calendar background (leave empty to remove)'
        }
      ],
      title: 'Change Background Image',
      acceptLabel: 'Save',
    } as const;
  },
  async (formData: FormOnSubmitEvent<JSONObject>, context: Devvit.Context) => {
    try {
      await EventService.updateBackgroundImage(
        formData.values.backgroundImage as string || '',
        data.redisKey,
        context
      );
      data.onSuccess();
      context.ui.showToast('Background image updated successfully');
    } catch (error) {
      context.ui.showToast(`Error while updating background: ${error}`);
    }
  }
);