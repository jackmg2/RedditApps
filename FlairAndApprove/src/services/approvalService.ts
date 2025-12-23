import { Devvit, JSONObject } from '@devvit/public-api';
import { FlairService } from './flairService.js';
import { UserService } from './userService.js';
import { ModNoteService } from './modNoteService.js';
import { StorageService } from './storageService.js';
import { AppSettings } from '../types/AppSettings.js';

interface ApprovalAction {
  task: () => Promise<any>;
  successMessage: string;
}

export class ApprovalService {
  static async processApproval(
    values: JSONObject,
    context: Devvit.Context
  ): Promise<void> {
    const {
      subRedditName,
      username,
      selectedFlair,
      postId,
      commentId,
      approveUser,
      approvePost,
      approveComment,
      comment
    } = values;

    const settings = await context.settings.getAll() as AppSettings;

    const actions: ApprovalAction[] = [
      {
        task: () => FlairService.setUserFlair(
          context,
          subRedditName as string,
          username as string,
          (selectedFlair as string[])[0]
        ),
        successMessage: 'Flair applied successfully.'
      },
      ...(approveUser ? [{
        task: async () => {
          await UserService.approveUser(
            context,
            username as string,
            subRedditName as string
          );
          
          // Store approval timestamp
          await StorageService.storeApprovalTimestamp(
            context,
            username as string,
            subRedditName as string
          );
          
          // Add mod note if enabled
          if (settings.autoAddModNote) {
            await ModNoteService.addApprovalNote(
              context,
              username as string,
              subRedditName as string,
              false // Manual approval
            );
          }
        },
        successMessage: `${username} approved.`
      }] : []),
      ...(approvePost ? [{
        task: () => context.reddit.approve(postId as string),
        successMessage: 'Post approved.'
      }] : []),
      ...(approveComment ? [{
        task: () => context.reddit.approve(commentId as string),
        successMessage: 'Comment approved.'
      }] : []),
      ...(comment ? [{
        task: async () => {
          const targetId = commentId ? commentId as string : postId as string;
          const commentResponse = await context.reddit.submitComment({
            id: targetId,
            text: comment as string
          });
          commentResponse.distinguish(true);
        },
        successMessage: 'Comment posted and pinned.'
      }] : [])
    ];

    await this.executeActions(actions, context);
  }

  static async processBulkApproval(
    values: JSONObject,
    context: Devvit.Context
  ): Promise<void> {
    const { subRedditName, usernames, selectedFlair, approveUsers } = values;
    const settings = await context.settings.getAll() as AppSettings;
    
    const usernameList = UserService.parseUsernameList(usernames as string);

    if (usernameList.length === 0) {
      context.ui.showToast('No valid usernames provided');
      return;
    }

    context.ui.showToast(`Processing ${usernameList.length} users...`);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const username of usernameList) {
      try {
        const actions = [];
        
        actions.push(
          FlairService.setUserFlair(
            context,
            subRedditName as string,
            username,
            (selectedFlair as string[])[0]
          )
        );

        if (approveUsers) {
          actions.push(
            UserService.approveUser(context, username, subRedditName as string)
          );
          
          // Store approval timestamp
          actions.push(
            StorageService.storeApprovalTimestamp(
              context,
              username,
              subRedditName as string
            )
          );
          
          // Add mod note for bulk approval if enabled
          if (settings.autoAddModNote) {
            actions.push(
              ModNoteService.addApprovalNote(
                context,
                username,
                subRedditName as string,
                true // Bulk approval
              )
            );
          }
        }

        await Promise.all(actions);
        successCount++;
        
      } catch (error) {
        errorCount++;
        if (error instanceof Error) {
          errors.push(`${username}: ${error.message}`);
        } else {
          errors.push(`${username}: Unknown error`);
        }
      }
    }

    this.showBulkResults(successCount, errorCount, errors, context);
  }

  private static async executeActions(
    actions: ApprovalAction[],
    context: Devvit.Context
  ): Promise<void> {
    try {
      const results = await Promise.allSettled(actions.map(action => action.task()));

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          context.ui.showToast(actions[index].successMessage);
        } else {
          context.ui.showToast(`Error: ${actions[index].successMessage} failed.`);
        }
      });
    } catch (error) {
      if (error instanceof Error) {
        context.ui.showToast(`An error occurred: ${error.message}`);
      }
    }
  }

  private static showBulkResults(
    successCount: number,
    errorCount: number,
    errors: string[],
    context: Devvit.Context
  ): void {
    if (successCount > 0) {
      context.ui.showToast(`✅ Successfully processed ${successCount} users`);
    }
    
    if (errorCount > 0) {
      context.ui.showToast(`❌ Failed to process ${errorCount} users`);
      if (errors.length > 0) {
        const errorSummary = errors.slice(0, 3).join('; ');
        context.ui.showToast(`Errors: ${errorSummary}${errors.length > 3 ? '...' : ''}`);
      }
    }
  }
}