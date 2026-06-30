import { redis } from '@devvit/web/server';
import type { PostRecord } from '../types/PostRecord';
import type { PostClass, PostState } from '../types/PostState';

export interface UserCounts {
  regular: number;
  monitored: number;
}

const POST_STATE_TTL_SECONDS = 180 * 24 * 60 * 60;
const APP_FLAIR_SET_TTL_MS = 5 * 60 * 1000;
// Per-month guard cap: bounds a single month's wiki page size. Only trims within
// an extreme single month, never across history.
const MAX_EVENTS_PER_MONTH = 2000;
// zSet registering every YYYY-MM that has events (score = numeric YYYYMM).
const EVENT_MONTHS_KEY = 'event_months';
// One-shot flag guarding the per-month bucket migration.
const EVENTS_MIGRATED_FLAG = 'events_migrated_v2';

export class redisService {
  // --- User counts (hash `user:<t2_id>`, fields `regular`/`monitored`) ---

  static async getUserCounts(userId: string): Promise<UserCounts> {
    const counts = await redis.hGetAll(`user:${userId}`);
    if (counts && Object.keys(counts).length > 0) {
      return {
        regular: Number(counts.regular ?? 0),
        monitored: Number(counts.monitored ?? 0),
      };
    }
    return await this.migrateLegacyUserRatio(userId);
  }

  static async setUserCounts(
    userId: string,
    regular: number,
    monitored: number
  ): Promise<void> {
    await redis.hSet(`user:${userId}`, {
      regular: String(Math.max(0, regular)),
      monitored: String(Math.max(0, monitored)),
    });
    // Drop any leftover legacy string key so it can never shadow the hash.
    await redis.del(userId);
  }

  /**
   * Atomically adjusts the counts via hIncrBy, clamping at 0. Returns the
   * resulting counts.
   */
  static async adjustUserCounts(
    userId: string,
    dRegular: number,
    dMonitored: number
  ): Promise<UserCounts> {
    // Ensure any legacy "x/y" value is migrated into the hash first.
    await this.getUserCounts(userId);

    const key = `user:${userId}`;
    let regular = await redis.hIncrBy(key, 'regular', dRegular);
    let monitored = await redis.hIncrBy(key, 'monitored', dMonitored);

    if (regular < 0) {
      await redis.hSet(key, { regular: '0' });
      regular = 0;
    }
    if (monitored < 0) {
      await redis.hSet(key, { monitored: '0' });
      monitored = 0;
    }

    return { regular, monitored };
  }

  /**
   * Migrates a legacy plain-string `"regular/monitored"` value into the hash.
   * The old app seeded every user with a free `0/1`; the new model expresses
   * that allowance through the `startingCredit` setting instead, so the seed
   * is stripped here (monitored - 1). With the default startingCredit of 1
   * the enforcement threshold is unchanged for migrated users.
   */
  private static async migrateLegacyUserRatio(
    userId: string
  ): Promise<UserCounts> {
    const legacy = await redis.get(userId);
    if (!legacy) {
      return { regular: 0, monitored: 0 };
    }

    const [legacyRegular, legacyMonitored] = legacy.split('/').map(Number);
    const regular = Math.max(0, legacyRegular ?? 0);
    const monitored = Math.max(0, (legacyMonitored ?? 1) - 1);

    await redis.hSet(`user:${userId}`, {
      regular: String(regular),
      monitored: String(monitored),
    });
    await redis.del(userId);
    console.log(
      `Migrated legacy ratio "${legacy}" for ${userId} to ${regular}/${monitored}`
    );

    return { regular, monitored };
  }

  // --- Per-post state (hash `post:<t3_id>`) ---

  static async getPostState(postId: string): Promise<PostState | undefined> {
    const data = await redis.hGetAll(`post:${postId}`);
    if (!data || data.class === undefined) {
      return undefined;
    }
    return {
      class: data.class as PostClass,
      counted: data.counted === '1',
      authorId: data.authorId ?? '',
      flairText: data.flairText ?? '',
      removed: data.removed === '1',
      appRemoved: data.appRemoved === '1',
    };
  }

  static async setPostState(postId: string, state: PostState): Promise<void> {
    const key = `post:${postId}`;
    await redis.hSet(key, {
      class: state.class,
      counted: state.counted ? '1' : '0',
      authorId: state.authorId,
      flairText: state.flairText,
      removed: state.removed ? '1' : '0',
      appRemoved: state.appRemoved ? '1' : '0',
    });
    await redis.expire(key, POST_STATE_TTL_SECONDS);
  }

  // --- Event history (per-month zSets `events:YYYY-MM`) ---

  /** Derives the `YYYY-MM` bucket from a record's date, falling back to its timestamp. */
  static monthOf(record: PostRecord): string {
    if (record.date && /^\d{4}-\d{2}/.test(record.date)) {
      return record.date.slice(0, 7);
    }
    const d = new Date(record.timestamp ?? Date.now());
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Appends a record to its month bucket. Returns the affected `YYYY-MM` month
   * and whether that month was newly registered (so callers can refresh the
   * index page only when a new month first appears).
   */
  static async addEvent(
    record: PostRecord
  ): Promise<{ month: string; monthCreated: boolean }> {
    await this.migrateEvents();
    const timestamp = record.timestamp ?? Date.now();
    const month = this.monthOf({ ...record, timestamp });
    const monthCreated =
      (await redis.zScore(EVENT_MONTHS_KEY, month)) == null;
    await redis.zAdd(`events:${month}`, {
      member: JSON.stringify({ ...record, timestamp }),
      score: timestamp,
    });
    await redis.zRemRangeByRank(
      `events:${month}`,
      0,
      -(MAX_EVENTS_PER_MONTH + 1)
    );
    await redis.zAdd(EVENT_MONTHS_KEY, {
      member: month,
      score: Number(month.replace('-', '')),
    });
    return { month, monthCreated };
  }

  /** Returns all `YYYY-MM` buckets that have events, oldest first. */
  static async getEventMonths(): Promise<string[]> {
    await this.migrateEvents();
    const members = await redis.zRange(EVENT_MONTHS_KEY, 0, -1, { by: 'rank' });
    return members.map(({ member }) => member);
  }

  /** Reads and parses the event records for a single `YYYY-MM` bucket. */
  static async getEventsForMonth(month: string): Promise<PostRecord[]> {
    const members = await redis.zRange(`events:${month}`, 0, -1, {
      by: 'rank',
    });
    const records: PostRecord[] = [];
    for (const { member } of members) {
      try {
        records.push(JSON.parse(member) as PostRecord);
      } catch {
        console.error(`Skipping unparseable event record: ${member}`);
      }
    }
    return records;
  }

  /**
   * One-time migration of legacy event storage into per-month buckets:
   *  - the legacy `posts` JSON-array key (oldest format), and
   *  - the single capped `events` zSet (previous format).
   * Both are folded into `events:YYYY-MM` buckets plus the `event_months`
   * registry, then deleted. Guarded by a flag so it runs at most once.
   */
  private static async migrateEvents(): Promise<void> {
    if (await redis.get(EVENTS_MIGRATED_FLAG)) {
      return;
    }
    // Mark first so concurrent triggers don't double-migrate.
    await redis.set(EVENTS_MIGRATED_FLAG, '1');

    try {
      // Legacy `posts` JSON array. Records only carry a day-precision date, so
      // the original array index is added to the derived score to preserve
      // same-day ordering.
      const postsJson = await redis.get('posts');
      if (postsJson) {
        const posts = JSON.parse(postsJson) as PostRecord[];
        for (let i = 0; i < posts.length; i++) {
          const post = posts[i]!;
          const timestamp = (Date.parse(post.date) || 0) + i;
          await this.bucketRecord({ ...post, timestamp });
        }
        console.log(`Migrated ${posts.length} legacy post records to buckets`);
        await redis.del('posts');
      }

      // Previous single `events` zSet.
      const events = await redis.zRange('events', 0, -1, { by: 'rank' });
      for (const { member, score } of events) {
        try {
          const record = JSON.parse(member) as PostRecord;
          await this.bucketRecord({
            ...record,
            timestamp: record.timestamp ?? score,
          });
        } catch {
          console.error(`Skipping unparseable event record: ${member}`);
        }
      }
      if (events.length > 0) {
        console.log(`Migrated ${events.length} events to per-month buckets`);
        await redis.del('events');
      }
    } catch (error) {
      console.error(`Failed to migrate events to buckets: ${error}`);
    }
  }

  /** Writes one record into its month bucket and registers the month. */
  private static async bucketRecord(record: PostRecord): Promise<void> {
    const timestamp = record.timestamp ?? Date.now();
    const month = this.monthOf({ ...record, timestamp });
    await redis.zAdd(`events:${month}`, {
      member: JSON.stringify({ ...record, timestamp }),
      score: timestamp,
    });
    await redis.zAdd(EVENT_MONTHS_KEY, {
      member: month,
      score: Number(month.replace('-', '')),
    });
  }

  // --- App-initiated flair write guard (`app_flair_set:<t3_id>`) ---

  static async markAppFlairSet(postId: string): Promise<void> {
    await redis.set(`app_flair_set:${postId}`, '1', {
      expiration: new Date(Date.now() + APP_FLAIR_SET_TTL_MS),
    });
  }

  static async wasAppFlairSet(postId: string): Promise<boolean> {
    return (await redis.get(`app_flair_set:${postId}`)) === '1';
  }

  static async clearAppFlairSet(postId: string): Promise<void> {
    await redis.del(`app_flair_set:${postId}`);
  }
}
