import { Devvit } from '@devvit/public-api';
import {
  postCommentMenuItem,
  createCommentMenuItem,
  createUserCommentMenuItem,
  editCommentMenuItem,
  editUserCommentMenuItem,
  deleteCommentMenuItem,
  deleteUserCommentMenuItem,
  viewAllCommentsMenuItem
} from './items.js';

export function registerMenuItems(): void {
  Devvit.addMenuItem(postCommentMenuItem);
  Devvit.addMenuItem(createCommentMenuItem);
  Devvit.addMenuItem(createUserCommentMenuItem);
  Devvit.addMenuItem(editCommentMenuItem);
  Devvit.addMenuItem(editUserCommentMenuItem);
  Devvit.addMenuItem(deleteCommentMenuItem);
  Devvit.addMenuItem(deleteUserCommentMenuItem);
  Devvit.addMenuItem(viewAllCommentsMenuItem);
}