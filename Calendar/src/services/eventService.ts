import { Devvit } from '@devvit/public-api';
import { Event } from '../types/Event.js';
import { RedisService } from './redisService.js';

export class EventService {
  static async addOrUpdateEvent(event: Event, redisKey: string, context: Devvit.Context): Promise<void> {
    const eventErrorMessage = event.isValid();
    if (eventErrorMessage !== '') {
      throw new Error(eventErrorMessage);
    }

    const eventsObj = await RedisService.getEvents(redisKey, context);
    eventsObj[event.id] = event;
    await RedisService.saveEvents(redisKey, eventsObj, context);
  }

  static async removeEvent(eventId: string, redisKey: string, context: Devvit.Context): Promise<void> {
    const eventsObj = await RedisService.getEvents(redisKey, context);
    delete eventsObj[eventId];
    await RedisService.saveEvents(redisKey, eventsObj, context);
  }

  static async updateBackgroundImage(newBackgroundImage: string, redisKey: string, context: Devvit.Context): Promise<void> {
    await RedisService.saveBackgroundImage(redisKey, newBackgroundImage, context);
  }
}