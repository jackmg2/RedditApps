import { redis } from '@devvit/web/server';
import type { Comment, UserComment } from '../types/index.js';

const KEYS = {
  COMMENTS: 'predefined_comments',
  USER_COMMENTS: 'user_comments',
  NEXT_ID: 'next_comment_id',
  NEXT_USER_ID: 'next_user_comment_id',
} as const;

export class CommentStorage {
  static async getComments(): Promise<Comment[]> {
    const stored = await redis.get(KEYS.COMMENTS);
    return stored ? JSON.parse(stored) : [];
  }

  static async saveComments(comments: Comment[]): Promise<void> {
    await redis.set(KEYS.COMMENTS, JSON.stringify(comments));
  }

  static async getUserComments(): Promise<UserComment[]> {
    const stored = await redis.get(KEYS.USER_COMMENTS);
    return stored ? JSON.parse(stored) : [];
  }

  static async saveUserComments(userComments: UserComment[]): Promise<void> {
    await redis.set(KEYS.USER_COMMENTS, JSON.stringify(userComments));
  }

  static async getNextId(): Promise<string> {
    const current = await redis.get(KEYS.NEXT_ID);
    const nextId = current ? parseInt(current) + 1 : 1;
    await redis.set(KEYS.NEXT_ID, nextId.toString());
    return nextId.toString();
  }

  static async getNextUserId(): Promise<string> {
    const current = await redis.get(KEYS.NEXT_USER_ID);
    const nextId = current ? parseInt(current) + 1 : 1;
    await redis.set(KEYS.NEXT_USER_ID, nextId.toString());
    return nextId.toString();
  }

  static async findCommentById(id: string): Promise<Comment | null> {
    const comments = await this.getComments();
    return comments.find((c) => c.id === id) ?? null;
  }

  static async findUserCommentById(id: string): Promise<UserComment | null> {
    const userComments = await this.getUserComments();
    return userComments.find((c) => c.id === id) ?? null;
  }

  static async deleteComment(id: string): Promise<boolean> {
    const comments = await this.getComments();
    const filtered = comments.filter((c) => c.id !== id);
    if (filtered.length < comments.length) {
      await this.saveComments(filtered);
      return true;
    }
    return false;
  }

  static async deleteUserComment(id: string): Promise<boolean> {
    const userComments = await this.getUserComments();
    const filtered = userComments.filter((c) => c.id !== id);
    if (filtered.length < userComments.length) {
      await this.saveUserComments(filtered);
      return true;
    }
    return false;
  }
}
