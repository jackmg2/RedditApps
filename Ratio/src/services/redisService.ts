import { TriggerContext, Devvit } from '@devvit/public-api';
import { PostRecord } from '../types/PostRecord.js';

export class redisService {
  static async getUserRatio(userId: string, context: TriggerContext | Devvit.Context): Promise<string> {
    return (await context.redis.get(userId)) ?? "0/1";
  }

  static async setUserRatio(
    userId: string, 
    regularPosts: number, 
    monitoredPosts: number,
    context: TriggerContext | Devvit.Context
  ): Promise<void> {
    await context.redis.set(userId, `${regularPosts}/${monitoredPosts}`);
  }

  static async getPostRecords(context: TriggerContext | Devvit.Context): Promise<PostRecord[]> {
    const postsJson = await context.redis.get('posts') as string;
    return postsJson ? JSON.parse(postsJson) : [];
  }

  static async savePostRecords(posts: PostRecord[], context: TriggerContext | Devvit.Context): Promise<void> {
    await context.redis.set('posts', JSON.stringify(posts));
  }

  static async addPostRecord(postRecord: PostRecord, context: TriggerContext | Devvit.Context): Promise<void> {
    const posts = await this.getPostRecords(context);
    posts.push(postRecord);
    await this.savePostRecords(posts, context);
  }
}