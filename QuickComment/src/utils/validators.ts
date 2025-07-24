import { Devvit } from '@devvit/public-api';
import { CommentStorage } from '../storage/index.js';

export function cleanUsername(username: string): string {
  return username.replace(/^u\//, '').trim();
}

export async function isUsernameAvailable(
  context: Devvit.Context, 
  username: string, 
  excludeId?: string
): Promise<boolean> {
  const userComments = await CommentStorage.getUserComments(context);
  const cleanedUsername = cleanUsername(username);
  
  return !userComments.some(c => 
    c.username.toLowerCase() === cleanedUsername.toLowerCase() &&
    c.id !== excludeId
  );
}

export function validateCommentData(data: any): boolean {
  return !!(data.title && data.comment);
}