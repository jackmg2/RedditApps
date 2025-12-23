import { Devvit } from '@devvit/public-api';

export class StorageService {
  private static readonly APPROVAL_ZSET_KEY = 'approval_timestamps';
  private static readonly LAST_EXPORT_KEY = 'last_export_date';

  /**
   * Get the full Redis key for a subreddit's approval timestamps
   */
  private static getApprovalKey(subredditName: string): string {
    return `${this.APPROVAL_ZSET_KEY}_${subredditName}`;
  }

  /**
   * Get the full Redis key for a subreddit's last export date
   */
  private static getLastExportKey(subredditName: string): string {
    return `${this.LAST_EXPORT_KEY}_${subredditName}`;
  }

  /**
   * Store the approval timestamp for a user using Redis sorted set
   * Score is the timestamp in milliseconds since epoch
   */
  static async storeApprovalTimestamp(
    context: Devvit.Context,
    username: string,
    subredditName: string
  ): Promise<void> {
    try {
      const key = this.getApprovalKey(subredditName);
      const timestamp = Date.now();
      await context.redis.zAdd(key, { member: username, score: timestamp });
    } catch (error) {
      console.error(`Failed to store approval timestamp for ${username}:`, error);
    }
  }

  /**
   * Get all approved users with their timestamps
   * Returns a map of username -> Date
   */
  static async getAllApprovalTimestamps(
    context: Devvit.Context,
    subredditName: string
  ): Promise<Map<string, Date>> {
    try {
      const key = this.getApprovalKey(subredditName);
      
      // Get all members with scores (timestamps)
      const results = await context.redis.zRange(key, 0, -1, { by: 'rank' });
      
      const timestamps = new Map<string, Date>();
      
      for (const result of results) {
        timestamps.set(result.member, new Date(result.score));
      }
      
      return timestamps;
    } catch (error) {
      console.error(`Failed to get approval timestamps:`, error);
      return new Map();
    }
  }

  /**
   * Get users approved within a specific time range
   */
  static async getUsersInTimeRange(
    context: Devvit.Context,
    subredditName: string,
    startTime: number,
    endTime: number
  ): Promise<string[]> {
    try {
      const key = this.getApprovalKey(subredditName);
      
      // Get members within the score (timestamp) range
      const results = await context.redis.zRange(key, startTime, endTime, { by: 'score' });
      
      return results.map(result => result.member);
    } catch (error) {
      console.error(`Failed to get users in time range:`, error);
      return [];
    }
  }

  /**
   * Store the last export date
   */
  static async storeLastExportDate(
    context: Devvit.Context,
    subredditName: string
  ): Promise<void> {
    try {
      const key = this.getLastExportKey(subredditName);
      const timestamp = new Date().toISOString();
      await context.redis.set(key, timestamp);
    } catch (error) {
      console.error(`Failed to store last export date:`, error);
    }
  }

  /**
   * Get the last export date
   */
  static async getLastExportDate(
    context: Devvit.Context,
    subredditName: string
  ): Promise<Date | null> {
    try {
      const key = this.getLastExportKey(subredditName);
      const timestamp = await context.redis.get(key);
      return timestamp ? new Date(timestamp) : null;
    } catch (error) {
      console.error(`Failed to get last export date:`, error);
      return null;
    }
  }

  /**
   * Get filtered usernames based on time range
   */
  static async getFilteredUsernames(
    context: Devvit.Context,
    subredditName: string,
    timeRange: 'all' | 'month' | 'week'
  ): Promise<Set<string>> {
    if (timeRange === 'all') {
      // For 'all', we return an empty set to indicate no filtering
      // The caller should include all approved users
      return new Set();
    }

    const now = Date.now();
    let startTime: number;
    
    if (timeRange === 'month') {
      // 30 days ago
      startTime = now - (30 * 24 * 60 * 60 * 1000);
    } else {
      // 7 days ago
      startTime = now - (7 * 24 * 60 * 60 * 1000);
    }

    const usernames = await this.getUsersInTimeRange(
      context,
      subredditName,
      startTime,
      now
    );
    
    return new Set(usernames);
  }
}