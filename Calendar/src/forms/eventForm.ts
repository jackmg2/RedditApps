import { Devvit, FormOnSubmitEvent, JSONObject } from '@devvit/public-api';
import { Event } from '../types/Event.js';
import { EventService } from '../services/eventService.js';

export const createEventForm = (data: any) => Devvit.createForm(
   () => {
    const event = JSON.parse(data.e) as Event;
    
    return {
      fields: [
        {
          name: 'id',
          label: `Id*`,
          type: 'string',
          disabled: true,
          defaultValue: `${event.id}`,
          onValidate: (e: any) => {
            if (e.value === '') { return 'Id can\'t be empty.' }
          }
        },
        {
          name: 'title',
          label: `Title*`,
          type: 'string',
          defaultValue: `${(event.title !== undefined && event.title !== 'undefined') ? event.title : ''}`,
          onValidate: (e: any) => {
            if (e.value === '') { return 'Title can\'t be empty.' }
          }
        },
        {
          name: 'dateBegin',
          label: `Begin Date*`,
          type: 'string',
          defaultValue: `${event.dateBegin}`,
          onValidate: async (e: any) => {
            const { isValidDate } = await import('../utils/validators.js');
            if (!isValidDate(e.value)) { return 'Date Begin must be a valid date in this format: YYYY-mm-dd.' }
          }
        },
        {
          name: 'dateEnd',
          label: `End Date*`,
          type: 'string',
          defaultValue: `${event.dateEnd}`,
          onValidate: async (e: any) => {
            const { isValidDate } = await import('../utils/validators.js');
            if (!isValidDate(e.value)) { return 'Date End must be a valid date in this format: YYYY-mm-dd.' }
          }
        },
        {
          name: 'hourBegin',
          label: `Begin Hour`,
          type: 'string',
          defaultValue: event.hourBegin
        },
        {
          name: 'hourEnd',
          label: `End Hour`,
          type: 'string',
          defaultValue: event.hourEnd
        },
        {
          name: 'description',
          label: `Description`,
          type: 'paragraph',
          defaultValue: `${(event.description !== undefined && event.description !== 'undefined') ? event.description : ''}`
        },
        {
          name: 'link',
          label: `Link`,
          type: 'string',
          defaultValue: `${(event.link !== undefined && event.link !== 'undefined') ? event.link : ''}`,
          onValidate: async (e: any) => {
            const { isValidUrl } = await import('../utils/validators.js');
            if (!isValidUrl(e.value)) { return 'Link must start with https.' }
          }
        },
        {
          name: 'backgroundColor',
          label: `Background Color`,
          type: 'string',
          defaultValue: `${event.backgroundColor}`,
          onValidate: async (e: any) => {
            const { isValidHexColor } = await import('../utils/validators.js');
            if (!isValidHexColor(e.value)) { return 'Color must be in a valid hexadecimal format: #FF00FF.' }
          }
        },
        {
          name: 'foregroundColor',
          label: `Foreground Color`,
          type: 'string',
          defaultValue: `${event.foregroundColor}`,
          onValidate: async (e: any) => {
            const { isValidHexColor } = await import('../utils/validators.js');
            if (!isValidHexColor(e.value)) { return 'Color must be in a valid hexadecimal format: #FF00FF.' }
          }
        }
      ],
      title: 'Event',
      acceptLabel: 'Save Event',
    } as const;
  },
  async (formData: FormOnSubmitEvent<JSONObject>, context: Devvit.Context) => {
    const event = Event.fromData(formData.values as any);
    const redisKey = data.redisKey;
    
    try {
      await EventService.addOrUpdateEvent(event, redisKey, context);
      data.onSuccess();
      context.ui.showToast(`Your event has been updated!`);
    } catch (error) {
      context.ui.showToast(error instanceof Error ? error.message : 'Failed to save event');
    }
  }
);