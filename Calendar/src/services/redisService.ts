import { Devvit } from '@devvit/public-api';
import { Event } from '../types/Event.js';
import { isValidDateRange } from '../utils/validators.js';

export class RedisService {
  static getRedisKey(postId: string | undefined, createdAt: Date | undefined): string {
    let redisId = 'events';
    if (postId && createdAt) {
      const updateDate = new Date(2024, 11, 5, 0, 0, 0, 0);
      if (createdAt.getTime() > updateDate.getTime()) {
        redisId += postId;
      }
    }
    return redisId;
  }

  static async getEvents(redisKey: string, context: Devvit.Context): Promise<{ [id: string]: Event }> {
    const eventsJson = await context.redis.get(redisKey) as string;
    const allEvents: { [id: string]: Event } = JSON.parse(eventsJson || '{}');
    
    // Clean old events
    const currentDate = new Date().toISOString().split('T')[0];
    const loadedEvents = Object.values(allEvents)
      .filter(e => {
        return isValidDateRange(currentDate, e.dateEnd);
      })
      .reduce((acc, event) => {
        acc[Number(event.id)] = event;
        return acc;
      }, {} as { [id: string]: Event });
      
    return loadedEvents;
  }

  static async saveEvents(redisKey: string, events: { [id: string]: Event }, context: Devvit.Context): Promise<void> {
    const eventsJson = JSON.stringify(events);
    await context.redis.set(redisKey, eventsJson);
  }

  static async getBackgroundImage(redisKey: string, context: Devvit.Context): Promise<string> {
    const backgroundImageData = await context.redis.get(`${redisKey}_background`) as string;
    return backgroundImageData || '';
  }

  static async saveBackgroundImage(redisKey: string, imageUrl: string, context: Devvit.Context): Promise<void> {
    await context.redis.set(`${redisKey}_background`, imageUrl || '');
  }
}