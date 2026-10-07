import { reddit, redis } from '@devvit/web/server';
import type { T1, T3 } from '@devvit/shared-types/tid.js';
import {
  removeUserContent,
  lockUserPosts,
  muteUser,
  trackBanActions,
  restoreRecordedContent,
  describeRestore,
  buildSuccessMessage,
  type BanInput,
  type UnbanInput,
  type RemovedContent,
} from './banService.js';

/**
 * A shadowban is enforced by this app, not by Reddit: the user stays unbanned
 * on Reddit's side, but every post or comment they submit in the subreddit is
 * removed by the submit triggers while a record exists in redis.
 */
export type ShadowbanInput = BanInput;

export type ShadowbanRecord = {
  username: string;
  shadowbannedAt: number;
  /** null means permanent */
  expiresAt: number | null;
  markAsSpam: boolean;
  ruleViolated: string;
};

const DAY_MS = 86_400_000;
const MOD_NOTE_MAX_LENGTH = 250;

function recordKey(subredditName: string, username: string): string {
  return `shadowban:${subredditName}:${username.toLowerCase()}`;
}

export async function getShadowbanRecord(
  subredditName: string,
  username: string
): Promise<ShadowbanRecord | undefined> {
  try {
    const raw = await redis.get(recordKey(subredditName, username));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<ShadowbanRecord>;
    return {
      username: parsed.username ?? username,
      shadowbannedAt: parsed.shadowbannedAt ?? 0,
      expiresAt: parsed.expiresAt ?? null,
      markAsSpam: Boolean(parsed.markAsSpam),
      ruleViolated: parsed.ruleViolated ?? '',
    };
  } catch (error) {
    console.error(`Failed to read shadowban record for ${username}: ${error}`);
    return undefined;
  }
}

export async function writeShadowbanRecord(
  subredditName: string,
  username: string,
  record: ShadowbanRecord
): Promise<void> {
  const key = recordKey(subredditName, username);
  await redis.set(key, JSON.stringify(record));
  if (record.expiresAt !== null) {
    const ttlSeconds = Math.max(1, Math.ceil((record.expiresAt - Date.now()) / 1000));
    await redis.expire(key, ttlSeconds);
  }
}

export async function deleteShadowbanRecord(subredditName: string, username: string): Promise<void> {
  await redis.del(recordKey(subredditName, username));
}

/** Builds "Shadowbanned: <rule> - <note> (YYYY-MM-DD)", trimmed to Reddit's 250-char mod note limit. */
export function buildShadowbanNote(ruleViolated: string, note: string, date: Date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  const suffix = ` (${day})`;
  const rule = ruleViolated.trim();
  const resolvedNote = note.trim();
  // A note template such as "{rule} - {ruleMessage}" already carries the rule title: do not prepend it twice.
  const details = rule.length > 0 && resolvedNote.includes(rule) ? resolvedNote : [rule, resolvedNote].filter((s) => s.length > 0).join(' - ');
  if (details.length === 0) return `Shadowbanned${suffix}`;

  const prefix = 'Shadowbanned: ';
  const room = MOD_NOTE_MAX_LENGTH - prefix.length - suffix.length;
  const body = details.length > room ? `${details.slice(0, room - 1)}…` : details;
  return `${prefix}${body}${suffix}`;
}

export async function processShadowban(input: ShadowbanInput): Promise<string> {
  const now = Date.now();
  const expiresAt = input.banDuration !== undefined ? now + input.banDuration * DAY_MS : null;

  // If the record can't be written there is nothing to enforce, so let the error propagate.
  await writeShadowbanRecord(input.subredditName, input.username, {
    username: input.username,
    shadowbannedAt: now,
    expiresAt,
    markAsSpam: input.markAsSpam,
    ruleViolated: input.ruleViolated,
  });

  const errors: string[] = [];

  try {
    await reddit.addModNote({
      subreddit: input.subredditName,
      user: input.username,
      note: buildShadowbanNote(input.ruleViolated, input.banNote),
      label: 'BAN',
    });
  } catch (error) {
    console.error(`Error adding mod note for ${input.username}: ${error}`);
    errors.push(`mod note: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  let removed: RemovedContent = { removedPostIds: [], removedCommentIds: [] };
  let lockedPostIds: string[] = [];

  if (input.removeContent !== 'Do not remove') {
    try {
      removed = await removeUserContent(input.username, input.subredditName, input.markAsSpam, input.removeContent);
    } catch (error) {
      console.error(`Error removing ${input.username}'s content: ${error}`);
      errors.push(`removal: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  if (input.lockPosts) {
    try {
      lockedPostIds = await lockUserPosts(input.username, input.subredditName);
    } catch (error) {
      console.error(`Error locking ${input.username}'s posts: ${error}`);
      errors.push(`lock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  let muted = false;
  if (input.muteUser) {
    try {
      await muteUser(input.username, input.subredditName, input.ruleViolated);
      muted = true;
    } catch (error) {
      console.error(`Error muting ${input.username}: ${error}`);
      errors.push(`mute: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  await trackBanActions(input.subredditName, input.username, removed, lockedPostIds, muted, input.markAsSpam);

  const base = buildSuccessMessage(input.username, input.removeContent, input.lockPosts, input.muteUser, 'shadowbanned');
  const enforcement = ' New posts and comments will be removed automatically.';
  if (errors.length === 0) return `${base}${enforcement}`;
  return `${base}${enforcement} ⚠️ ${errors.join('; ')}`;
}

/**
 * Called from the post/comment submit triggers. Removes the content when the
 * author is shadowbanned and records the id so Undo Ban can re-approve it.
 */
export async function enforceShadowban(subredditName: string, username: string, targetId: T1 | T3): Promise<boolean> {
  const record = await getShadowbanRecord(subredditName, username);
  if (!record) return false;

  if (record.expiresAt !== null && record.expiresAt <= Date.now()) {
    await deleteShadowbanRecord(subredditName, username);
    return false;
  }

  await reddit.remove(targetId, record.markAsSpam);

  const isPost = targetId.startsWith('t3_');
  await trackBanActions(
    subredditName,
    record.username,
    { removedPostIds: isPost ? [targetId] : [], removedCommentIds: isPost ? [] : [targetId] },
    [],
    false,
    record.markAsSpam
  );
  return true;
}

export async function processUnshadowban(input: UnbanInput): Promise<string> {
  await deleteShadowbanRecord(input.subredditName, input.username);
  const result = await restoreRecordedContent(input);
  return [`✅ ${input.username} is no longer shadowbanned.`, ...describeRestore(result, input)].join(' ');
}
