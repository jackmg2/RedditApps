import {context, reddit, redis, scheduler} from '@devvit/web/server'
import type {T2, T3} from '@devvit/web/shared'
import {key} from './store/keys.ts'
import {
  deleteDraft,
  deleteRom,
  deleteUserData,
  getDraft,
  getRomIdForPost,
  getUserDraftPostId,
  listStaleDrafts,
  sweepExpiredSaves,
} from './store/store.ts'
import {refreshWikiPage} from './wiki.ts'

/** A post still waiting for its ROM after this long is removed. */
export const draftMaxAgeMs = 60 * 60 * 1000

/** Canonical URL of a post in the current subreddit. */
export function postUrl(postId: string): string {
  return `https://www.reddit.com/r/${context.subredditName}/comments/${postId.replace(/^t3_/, '')}/`
}

/** Removes a post as the app account (a moderator); logs, never throws. */
async function removePost(postId: string, note?: string): Promise<void> {
  try {
    const post = await reddit.getPostById(postId as T3)
    await post.remove()
    if (note)
      await post.addRemovalNote({reasonId: '', modNote: note.slice(0, 100)})
  } catch (err) {
    console.error(`removePost ${postId} failed;`, err)
  }
}

/** Is this post one the app tracks (a ROM post or one waiting for its ROM)? */
export async function isAppPost(postId: string): Promise<boolean> {
  if (await getRomIdForPost(postId)) return true
  return !!(await getDraft(postId))
}

/**
 * Removal sync / post deletion: forgets everything stored for the post. The
 * post itself is already gone or removed by Reddit.
 */
export async function deletePostData(postId: string): Promise<void> {
  const romId = await getRomIdForPost(postId)
  await deleteDraft(postId)
  if (romId && (await deleteRom(romId))) await refreshWikiPage()
}

/**
 * URL of the user's post that is still waiting for its ROM, if it is still
 * up. A removed one is forgotten so the user can start again.
 */
export async function openDraftUrl(
  userId: string,
): Promise<string | undefined> {
  const postId = await getUserDraftPostId(userId)
  if (!postId) return
  try {
    const post = await reddit.getPostById(postId as T3)
    if (!post.removed) return post.url
  } catch (err) {
    console.error(`openDraftUrl: lookup of ${postId} failed;`, err)
  }
  await deleteDraft(postId)
  return
}

export const draftExpiryJob = 'draft-expiry'

/**
 * Schedules the removal of a post that is still waiting for its ROM. Best
 * effort: if scheduling fails, the daily sweep removes it instead.
 */
export async function scheduleDraftExpiry(
  postId: string,
  createdAt: number,
): Promise<void> {
  try {
    await scheduler.runJob({
      name: draftExpiryJob,
      data: {postId},
      runAt: new Date(createdAt + draftMaxAgeMs),
    })
  } catch (err) {
    console.error(`scheduleDraftExpiry ${postId} failed;`, err)
  }
}

/**
 * Removes the post if it is still waiting for its ROM and old enough. A post
 * whose ROM is being uploaded right now (already claimed) is left alone.
 */
export async function expireDraft(
  postId: string,
  now: number = Date.now(),
): Promise<boolean> {
  const draft = await getDraft(postId)
  if (!draft || now - draft.createdAt < draftMaxAgeMs - 60_000) return false
  if (await getRomIdForPost(postId)) return false
  await deleteDraft(postId)
  await removePost(postId, 'No ROM was uploaded within 1 hour')
  return true
}

/** Fallback for missed expiry jobs: removes every overdue waiting post. */
export async function sweepStaleDrafts(
  now: number = Date.now(),
): Promise<number> {
  let removed = 0
  for (const postId of await listStaleDrafts(now - draftMaxAgeMs))
    if (await expireDraft(postId, now)) removed++
    else if (!(await getDraft(postId))) await deleteDraft(postId)
  return removed
}

const sweepBatch = 100
/** An account must look deleted on two sweeps this far apart. */
const missingGraceMs = 20 * 60 * 60 * 1000

/**
 * Daily job standing in for an account-deletion trigger, which Devvit does
 * not offer (spec §3.6, §13 Q6). Walks users with stored data in batches;
 * an account that `getUserById` no longer resolves on two sweeps ≥ 20 h
 * apart has its ROMs and saves deleted and its ROM posts removed. Also
 * reconciles battery saves whose TTL lapsed, removes posts that never got
 * their ROM, and rewrites the wiki list to repair any missed update.
 */
export async function accountSweep(now: number = Date.now()): Promise<{
  checked: number
  deletedUsers: number
}> {
  await sweepExpiredSaves(now)
  await sweepStaleDrafts(now)

  const total = await redis.zCard(key.users)
  let cursor = Number((await redis.get(key.sweepCursor)) ?? 0)
  if (!Number.isFinite(cursor) || cursor >= total) cursor = 0
  const users = await redis.zRange(key.users, cursor, cursor + sweepBatch - 1, {
    by: 'rank',
  })

  let next = cursor + users.length
  let deletedUsers = 0
  for (const {member: userId} of users) {
    let exists: boolean
    try {
      exists = !!(await reddit.getUserById(userId as T2))
    } catch (err) {
      console.error(`accountSweep: lookup of ${userId} failed;`, err)
      continue
    }
    if (exists) {
      await redis.hDel(key.sweepMissing, [userId])
      continue
    }
    const firstMissing = Number(
      (await redis.hGet(key.sweepMissing, userId)) ?? 0,
    )
    if (!firstMissing) {
      await redis.hSet(key.sweepMissing, {[userId]: `${now}`})
      continue
    }
    if (now - firstMissing < missingGraceMs) continue

    const draftPostId = await getUserDraftPostId(userId)
    if (draftPostId) {
      await deleteDraft(draftPostId)
      await removePost(draftPostId, 'Uploader account deleted')
    }
    const deleted = await deleteUserData(userId)
    for (const rec of deleted)
      if (rec.postId) await removePost(rec.postId, 'Uploader account deleted')
    deletedUsers++
    next-- // the user left the zset, shifting later ranks down by one
  }

  await redis.set(key.sweepCursor, `${next >= total - deletedUsers ? 0 : next}`)
  await refreshWikiPage()
  return {checked: users.length, deletedUsers}
}
