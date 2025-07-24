import { Devvit } from '@devvit/public-api';
import { Comment, UserComment } from '../types/index.js';
import { STORAGE_KEYS } from './keys.js';

export class CommentStorage {
  static async getComments(context: Devvit.Context): Promise<Comment[]> {
    const stored = await context.redis.get(STORAGE_KEYS.COMMENTS);
    return stored ? JSON.parse(stored) : [];
  }

  static async saveComments(context: Devvit.Context, comments: Comment[]): Promise<void> {
    await context.redis.set(STORAGE_KEYS.COMMENTS, JSON.stringify(comments));
  }

  static async getUserComments(context: Devvit.Context): Promise<UserComment[]> {
    const stored = await context.redis.get(STORAGE_KEYS.USER_COMMENTS);
    return stored ? JSON.parse(stored) : [];
  }

  static async saveUserComments(context: Devvit.Context, userComments: UserComment[]): Promise<void> {
    await context.redis.set(STORAGE_KEYS.USER_COMMENTS, JSON.stringify(userComments));
  }

  static async getNextId(context: Devvit.Context): Promise<string> {
    const current = await context.redis.get(STORAGE_KEYS.NEXT_ID);
    const nextId = current ? parseInt(current) + 1 : 1;
    await context.redis.set(STORAGE_KEYS.NEXT_ID, nextId.toString());
    return nextId.toString();
  }

  static async getNextUserId(context: Devvit.Context): Promise<string> {
    const current = await context.redis.get(STORAGE_KEYS.NEXT_USER_ID);
    const nextId = current ? parseInt(current) + 1 : 1;
    await context.redis.set(STORAGE_KEYS.NEXT_USER_ID, nextId.toString());
    return nextId.toString();
  }

  static async findCommentById(context: Devvit.Context, id: string): Promise<Comment | null> {
    const comments = await this.getComments(context);
    return comments.find(c => c.id === id) || null;
  }

  static async findUserCommentById(context: Devvit.Context, id: string): Promise<UserComment | null> {
    const userComments = await this.getUserComments(context);
    return userComments.find(c => c.id === id) || null;
  }

  static async deleteComment(context: Devvit.Context, id: string): Promise<boolean> {
    const comments = await this.getComments(context);
    const filteredComments = comments.filter(c => c.id !== id);
    
    if (filteredComments.length < comments.length) {
      await this.saveComments(context, filteredComments);
      return true;
    }
    return false;
  }

  static async deleteUserComment(context: Devvit.Context, id: string): Promise<boolean> {
    const userComments = await this.getUserComments(context);
    const filteredComments = userComments.filter(c => c.id !== id);
    
    if (filteredComments.length < userComments.length) {
      await this.saveUserComments(context, filteredComments);
      return true;
    }
    return false;
  }
}