import { Devvit, JSONObject } from '@devvit/public-api';
import { BanEvent } from '../types/banEvent.js';

interface TimeFilters {
  'last 24 hours': number;
  'previous 3 days': number;
  'previous 7 days': number;
  'all time': number;
}

export class BanService {
  /**
   * Ban a user from a subreddit
   */
  static async banUser(
    context: Devvit.Context,
    banEvent: BanEvent
  ): Promise<void> {
    await context.reddit.banUser({
      subredditName: banEvent.subRedditName,
      username: banEvent.username,
      duration: banEvent.banDuration,
      reason: `${banEvent.ruleViolated}`.substring(0, 100),
      message: banEvent.banMessage,
    });
  }

  /**
   * Remove user's content from a subreddit within a time period
   */
  static async removeUserContent(
    context: Devvit.Context,
    username: string,
    subredditName: string,
    markAsSpam: boolean,
    timePeriod: string
  ): Promise<void> {
    const [allPosts, allComments] = await Promise.all([
      this.getUserPosts(context, username),
      this.getUserComments(context, username)
    ]);

    const postsToRemove = this.filterBySubredditAndTime(
      allPosts.map(p => ({ 
        id: p.id, 
        subredditName: p.subredditName, 
        createdAt: p.createdAt 
      })),
      subredditName,
      timePeriod
    );

    const commentsToRemove = this.filterBySubredditAndTime(
      allComments.map(c => ({ 
        id: c.id, 
        subredditName: c.subredditName, 
        createdAt: c.createdAt 
      })),
      subredditName,
      timePeriod
    );

    await Promise.all([
      ...postsToRemove.map(item => context.reddit.remove(item.id, markAsSpam)),
      ...commentsToRemove.map(item => context.reddit.remove(item.id, markAsSpam))
    ]);
  }

  /**
   * Process a single ban with optional content removal
   */
  static async processBan(
    values: JSONObject,
    context: Devvit.Context
  ): Promise<void> {
    const banEvent = BanEvent.fromJson(values);
    const removeContentString = (banEvent.removeContent === undefined || banEvent.removeContent.length <= 0) 
      ? 'Do not remove' 
      : banEvent.removeContent[0];
    
    let errorDuringBan = false;
    let errorDuringRemoval = false;

    try {
      await this.banUser(context, banEvent);
    } catch (error) {
      const errorMessage = `An error happened during ban of ${banEvent.username}: ${error}`;
      console.error(errorMessage);
      context.ui.showToast(errorMessage);
      errorDuringBan = true;
    }

    if (removeContentString !== 'Do not remove') {
      try {
        await this.removeUserContent(
          context,
          banEvent.username,
          banEvent.subRedditName,
          banEvent.markAsSpam,
          removeContentString
        );
      } catch (error) {
        const errorMessage = `An error happened during ${banEvent.username}'s content removal: ${error}`;
        console.error(errorMessage);
        context.ui.showToast(errorMessage);
        errorDuringRemoval = true;
      }
    }

    if (!errorDuringBan && !errorDuringRemoval) {
      const message = this.buildSuccessMessage(banEvent.username, removeContentString);
      context.ui.showToast(message);
    }
  }

  /**
   * Process bulk ban of multiple users
   */
  static async processBulkBan(
    values: JSONObject,
    context: Devvit.Context
  ): Promise<void> {
    const { subRedditName, usernames, banDuration, ruleViolated, banMessage, removeContent, markAsSpam } = values;
    
    const usernameList = (usernames as string)
      .split(';')
      .map(name => name.trim())
      .filter(name => name.length > 0);

    if (usernameList.length === 0) {
      context.ui.showToast('No valid usernames provided');
      return;
    }

    context.ui.showToast(`Processing ${usernameList.length} users...`);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    const removeContentString = (removeContent === undefined || removeContent.length <= 0) 
      ? 'Do not remove' 
      : removeContent[0];
    const duration = banDuration[0] === 'permanent' ? undefined : parseInt(banDuration[0]);

    for (const username of usernameList) {
      let errorDuringBan = false;
      let errorDuringRemoval = false;

      try {
        await context.reddit.banUser({
          subredditName: subRedditName as string,
          username: username,
          duration: duration,
          reason: `${ruleViolated}`.substring(0, 100),
          message: banMessage as string,
        });
      } catch (error) {
        errorDuringBan = true;
        if (error instanceof Error) {
          errors.push(`${username} (ban): ${error.message}`);
        } else {
          errors.push(`${username} (ban): Unknown error`);
        }
      }

      if (!errorDuringBan && removeContentString !== 'Do not remove') {
        try {
          await this.removeUserContent(
            context,
            username,
            subRedditName as string,
            markAsSpam as boolean,
            removeContentString
          );
        } catch (error) {
          errorDuringRemoval = true;
          if (error instanceof Error) {
            errors.push(`${username} (content removal): ${error.message}`);
          } else {
            errors.push(`${username} (content removal): Unknown error`);
          }
        }
      }

      if (!errorDuringBan && !errorDuringRemoval) {
        successCount++;
      } else {
        errorCount++;
      }
    }

    this.showBulkResults(successCount, errorCount, errors, context);
  }

  private static async getUserPosts(context: Devvit.Context, username: string) {
    return await context.reddit.getPostsByUser({ username }).all();
  }

  private static async getUserComments(context: Devvit.Context, username: string) {
    return await context.reddit.getCommentsByUser({ username }).all();
  }

  private static filterBySubredditAndTime(
    items: any[],
    subredditName: string,
    timePeriod: string
  ) {
    const now = Date.now();
    const timeFilters: TimeFilters = {
      'last 24 hours': 86400000,
      'previous 3 days': 259200000,
      'previous 7 days': 604800000,
      'all time': Infinity
    };
    const timeLimit = timeFilters[timePeriod as keyof TimeFilters];

    return items.filter(item =>
      item.subredditName === subredditName &&
      (now - new Date(item.createdAt).getTime()) <= timeLimit
    );
  }

  private static buildSuccessMessage(username: string, removeContentString: string): string {
    let message = `${username} has been banned`;
    let removeContentMessage = '';

    switch (removeContentString) {
      case 'last 24 hours':
        removeContentMessage = ' and their content has been removed for the past 24 hours.';
        break;
      case 'previous 3 days':
        removeContentMessage = ' and their content has been removed for the past 3 days.';
        break;
      case 'previous 7 days':
        removeContentMessage = ' and their content has been removed for the past 7 days.';
        break;
      case 'all time':
        removeContentMessage = ' and all of their content has been removed.';
        break;
      case 'Do not remove':
        removeContentMessage = ' and their content has been kept.';
        break;
    }

    return message + removeContentMessage;
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