import { reddit, settings } from '@devvit/web/server';
import { isT1, isT3 } from '@devvit/shared-types/tid.js';
import type { AppSettings } from '../types/AppSettings.js';
import * as flairService from './flairService.js';
import * as userService from './userService.js';
import * as modNoteService from './modNoteService.js';
import * as storageService from './storageService.js';
import { trackComment } from '../toolkit/contentTracker.js';

export type ApprovalInput = {
  subredditName: string;
  username: string;
  flairTemplateId: string | undefined;
  postId: string | undefined;
  commentId: string | undefined;
  approveUser: boolean;
  approvePost: boolean;
  approveComment: boolean;
  welcomeComment: string;
};

export type BulkApprovalInput = {
  subredditName: string;
  usernames: string;
  flairTemplateId: string | undefined;
  approveUsers: boolean;
};

export type BulkApprovalResult = {
  successCount: number;
  errorCount: number;
  errors: string[];
};

type ActionResult = { label: string; ok: boolean };

// `name` labels the step in the toast when it throws, so a failure says
// which action broke and why instead of a generic "Action failed".
type ApprovalTask = { name: string; run: () => Promise<ActionResult> };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function summarize(results: ActionResult[]): string {
  return results.map((r) => (r.ok ? r.label : `${r.label} failed`)).join('. ');
}

export async function processApproval(input: ApprovalInput): Promise<string> {
  const config = await settings.getAll<AppSettings>();
  const autoModNote = config.autoAddModNote ?? true;

  const tasks: ApprovalTask[] = [];

  if (input.flairTemplateId) {
    const flairTemplateId = input.flairTemplateId;
    tasks.push({
      name: 'Flair',
      run: async () => {
        await flairService.setUserFlair(input.subredditName, input.username, flairTemplateId);
        return { label: 'Flair applied', ok: true };
      },
    });
  }

  if (input.approveUser) {
    tasks.push({
      name: 'User approval',
      run: async () => {
        await userService.approveUser(input.username, input.subredditName);
        await storageService.storeApprovalTimestamp(input.username, input.subredditName);
        if (autoModNote) {
          await modNoteService.addApprovalNote(input.username, input.subredditName, false);
        }
        return { label: `${input.username} approved`, ok: true };
      },
    });
  }

  if (input.approvePost && input.postId) {
    const postId = input.postId;
    tasks.push({
      name: 'Post approval',
      run: async () => {
        if (!isT3(postId)) return { label: 'Post approval (invalid post id)', ok: false };
        await reddit.approve(postId);
        return { label: 'Post approved', ok: true };
      },
    });
  }

  if (input.approveComment && input.commentId) {
    const commentId = input.commentId;
    tasks.push({
      name: 'Comment approval',
      run: async () => {
        if (!isT1(commentId)) return { label: 'Comment approval (invalid comment id)', ok: false };
        await reddit.approve(commentId);
        return { label: 'Comment approved', ok: true };
      },
    });
  }

  if (input.welcomeComment.trim()) {
    const targetId = input.commentId ?? input.postId;
    if (targetId) {
      tasks.push({
        name: 'Welcome comment',
        run: async () => {
          if (!isT1(targetId) && !isT3(targetId)) {
            return { label: 'Welcome comment (invalid target id)', ok: false };
          }
          const newComment = await reddit.submitComment({ id: targetId, text: input.welcomeComment });
          await trackComment(newComment.id);
          // No distinguish/pin: Devvit returns 403 Forbidden on distinguish
          // for the app's own comments (r/Devvit 1n32tcv).
          return { label: 'Comment posted', ok: true };
        },
      });
    }
  }

  const settled = await Promise.allSettled(tasks.map((t) => t.run()));
  const results: ActionResult[] = settled.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    const name = tasks[i]!.name;
    console.error(`${name} failed for ${input.username} in r/${input.subredditName}:`, r.reason);
    return { label: `${name} (${errorMessage(r.reason)})`, ok: false };
  });

  return summarize(results);
}

export async function processBulkApproval(input: BulkApprovalInput): Promise<BulkApprovalResult> {
  const config = await settings.getAll<AppSettings>();
  const autoModNote = config.autoAddModNote ?? true;

  const usernameList = userService.parseUsernameList(input.usernames);
  let successCount = 0;
  const errors: string[] = [];

  for (const username of usernameList) {
    try {
      if (input.flairTemplateId) {
        await flairService.setUserFlair(input.subredditName, username, input.flairTemplateId);
      }

      if (input.approveUsers) {
        await userService.approveUser(username, input.subredditName);
        await storageService.storeApprovalTimestamp(username, input.subredditName);
        if (autoModNote) {
          await modNoteService.addApprovalNote(username, input.subredditName, true);
        }
      }

      successCount++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`${username}: ${msg}`);
    }
  }

  return { successCount, errorCount: errors.length, errors };
}
