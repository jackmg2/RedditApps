import {randomBytes} from 'node:crypto'
import {redis} from '@devvit/web/server'
import type {
  RomPublicMeta,
  StorageInfo,
  ValidationNote,
} from '../../shared/api.ts'
import type {ColourMode} from '../../shared/rom.ts'
import {key} from './keys.ts'

/** Redis budget per installation (spec §5.1). */
export const storageLimitBytes = 500 * 1024 * 1024
export const storageWarnRatio = 0.8
export const storageBlockRatio = 0.95
export const maxSavesPerUser = 20
export const saveTtlMs = 180 * 24 * 60 * 60 * 1000

export class LibraryFullError extends Error {
  constructor() {
    super('Library is full')
    this.name = 'LibraryFullError'
  }
}

/**
 * Wraps a Redis write, mapping quota / size errors to LibraryFullError so
 * routes can answer "Library is full" instead of crashing (spec §5.1).
 */
export async function writeResult<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/quota|oom|maxmemory|exceed|too large/i.test(msg))
      throw new LibraryFullError()
    throw err
  }
}

// --- Storage accounting --------------------------------------------------------

export async function getStorage(): Promise<StorageInfo> {
  const bytes = Math.max(0, Number((await redis.get(key.storageBytes)) ?? 0))
  return {
    bytes,
    limitBytes: storageLimitBytes,
    warn: bytes >= storageLimitBytes * storageWarnRatio,
    blocked: bytes >= storageLimitBytes * storageBlockRatio,
  }
}

async function addStorage(delta: number): Promise<void> {
  if (delta !== 0) await redis.incrBy(key.storageBytes, Math.round(delta))
}

// --- ROM records ---------------------------------------------------------------

export type RomStatus = 'pending' | 'live'

export type RomRecord = {
  romId: string
  title: string
  description: string
  licence: string
  sourceUrl: string
  uploaderId: string
  uploaderName: string
  postId: string
  status: RomStatus
  sizeBytes: number
  /** Bytes this ROM costs in Redis (base64 + cover). */
  storedBytes: number
  sha256: string
  cartType: number
  cgbFlag: number
  sgbFlag: number
  licenseeCode: string
  headerTitle: string
  validation: ValidationNote[]
  attestedAt: number
  attestedBy: string
  createdAt: number
  colourMode: ColourMode
  hasCover: boolean
}

export function newRomId(sha256: string): string {
  return sha256.slice(0, 16) + randomBytes(2).toString('hex')
}

function toHash(r: RomRecord): {[field: string]: string} {
  return {
    romId: r.romId,
    title: r.title,
    description: r.description,
    licence: r.licence,
    sourceUrl: r.sourceUrl,
    uploaderId: r.uploaderId,
    uploaderName: r.uploaderName,
    postId: r.postId,
    status: r.status,
    sizeBytes: `${r.sizeBytes}`,
    storedBytes: `${r.storedBytes}`,
    sha256: r.sha256,
    cartType: `${r.cartType}`,
    cgbFlag: `${r.cgbFlag}`,
    sgbFlag: `${r.sgbFlag}`,
    licenseeCode: r.licenseeCode,
    headerTitle: r.headerTitle,
    validation: JSON.stringify(r.validation),
    attestedAt: `${r.attestedAt}`,
    attestedBy: r.attestedBy,
    createdAt: `${r.createdAt}`,
    colourMode: r.colourMode,
    hasCover: r.hasCover ? '1' : '0',
  }
}

function fromHash(h: {[field: string]: string}): RomRecord | undefined {
  if (!h.romId) return
  let validation: ValidationNote[] = []
  try {
    validation = JSON.parse(h.validation ?? '[]')
  } catch {}
  const mode = h.colourMode
  return {
    romId: h.romId,
    title: h.title ?? '',
    description: h.description ?? '',
    licence: h.licence ?? '',
    sourceUrl: h.sourceUrl ?? '',
    uploaderId: h.uploaderId ?? '',
    uploaderName: h.uploaderName ?? '',
    postId: h.postId ?? '',
    status: h.status === 'live' ? 'live' : 'pending',
    sizeBytes: Number(h.sizeBytes ?? 0),
    storedBytes: Number(h.storedBytes ?? 0),
    sha256: h.sha256 ?? '',
    cartType: Number(h.cartType ?? 0),
    cgbFlag: Number(h.cgbFlag ?? 0),
    sgbFlag: Number(h.sgbFlag ?? 0),
    licenseeCode: h.licenseeCode ?? '',
    headerTitle: h.headerTitle ?? '',
    validation,
    attestedAt: Number(h.attestedAt ?? 0),
    attestedBy: h.attestedBy ?? '',
    createdAt: Number(h.createdAt ?? 0),
    colourMode: mode === 'dmg' || mode === 'cgb' ? mode : 'auto',
    hasCover: h.hasCover === '1',
  }
}

export function publicMeta(r: RomRecord): RomPublicMeta {
  return {
    romId: r.romId,
    postId: r.postId,
    title: r.title,
    description: r.description,
    licence: r.licence,
    sourceUrl: r.sourceUrl,
    uploaderName: r.uploaderName,
    createdAt: r.createdAt,
    sizeBytes: r.sizeBytes,
    headerTitle: r.headerTitle,
    cartType: r.cartType,
    cgbFlag: r.cgbFlag,
    sgbFlag: r.sgbFlag,
    colourMode: r.colourMode,
    hasCover: r.hasCover,
  }
}

export async function getRom(romId: string): Promise<RomRecord | undefined> {
  return fromHash(await redis.hGetAll(key.romMeta(romId)))
}

export async function getRomIdForPost(
  postId: string,
): Promise<string | undefined> {
  return (await redis.get(key.post(postId))) || undefined
}

export async function getRomBin(romId: string): Promise<string | undefined> {
  return (await redis.get(key.romBin(romId))) || undefined
}

export async function getRomCover(romId: string): Promise<string | undefined> {
  return (await redis.get(key.romCover(romId))) || undefined
}

/** Post id of an existing ROM with this hash (live or being uploaded). */
export async function findDuplicate(
  sha256: string,
): Promise<string | undefined> {
  const romId = await redis.get(key.hash(sha256))
  if (!romId) return
  const rom = await getRom(romId)
  if (!rom) {
    await redis.del(key.hash(sha256)) // stale pointer
    return
  }
  return rom.postId
}

export async function countUserRoms(userId: string): Promise<number> {
  return redis.zCard(key.userRoms(userId))
}

/**
 * Claims a post for a ROM. A post holds at most one ROM, ever: the claim is
 * only released if storing the ROM fails, so an uploaded ROM is immutable.
 */
export async function claimPost(
  postId: string,
  romId: string,
): Promise<boolean> {
  await redis.set(key.post(postId), romId, {nx: true})
  return (await redis.get(key.post(postId))) === romId
}

export async function releasePost(
  postId: string,
  romId: string,
): Promise<void> {
  if ((await redis.get(key.post(postId))) === romId)
    await redis.del(key.post(postId))
}

/**
 * Stores a validated ROM in `pending` state (not playable yet). Returns false if
 * a concurrent upload claimed the same hash first.
 */
export async function storeRom(
  rec: RomRecord,
  romBase64: string,
  cover: string | undefined,
): Promise<boolean> {
  await redis.set(key.hash(rec.sha256), rec.romId, {nx: true})
  if ((await redis.get(key.hash(rec.sha256))) !== rec.romId) return false

  try {
    await writeResult(async () => {
      await redis.set(key.romBin(rec.romId), romBase64)
      if (cover) await redis.set(key.romCover(rec.romId), cover)
      await redis.hSet(key.romMeta(rec.romId), toHash(rec))
    })
  } catch (err) {
    await redis.del(
      key.romBin(rec.romId),
      key.romCover(rec.romId),
      key.romMeta(rec.romId),
      key.hash(rec.sha256),
    )
    throw err
  }
  await addStorage(rec.storedBytes)
  return true
}

/** Marks a stored ROM live, lists it and retires the post's draft. */
export async function attachPost(
  rec: RomRecord,
  postId: string,
): Promise<void> {
  await redis.hSet(key.romMeta(rec.romId), {postId, status: 'live'})
  await redis.set(key.post(postId), rec.romId)
  await redis.zAdd(key.userRoms(rec.uploaderId), {
    member: rec.romId,
    score: rec.createdAt,
  })
  await redis.zAdd(key.library, {member: rec.romId, score: rec.createdAt})
  const row: ListingRow = {
    postId,
    title: rec.title,
    uploaderName: rec.uploaderName,
    sizeBytes: rec.sizeBytes,
    licence: rec.licence,
    cgbFlag: rec.cgbFlag,
    createdAt: rec.createdAt,
  }
  await redis.hSet(key.listing, {[rec.romId]: JSON.stringify(row)})
  await deleteDraft(postId)
  await touchUser(rec.uploaderId)
}

/**
 * Deletes a ROM and everything tied to it: bytes, metadata, cover, saves
 * and indexes. Idempotent. Returns the record that was deleted.
 */
export async function deleteRom(romId: string): Promise<RomRecord | undefined> {
  const rec = await getRom(romId)

  const savers = await redis.zRange(key.romSavers(romId), 0, -1, {by: 'rank'})
  for (const {member: userId} of savers) await deleteSave(romId, userId)

  await redis.del(
    key.romBin(romId),
    key.romCover(romId),
    key.romMeta(romId),
    key.romSavers(romId),
  )
  await redis.zRem(key.library, [romId])
  await redis.hDel(key.listing, [romId])
  if (!rec) return

  if (rec.postId && (await redis.get(key.post(rec.postId))) === romId)
    await redis.del(key.post(rec.postId))
  if ((await redis.get(key.hash(rec.sha256))) === romId)
    await redis.del(key.hash(rec.sha256))
  if (rec.uploaderId) await redis.zRem(key.userRoms(rec.uploaderId), [romId])
  await addStorage(-rec.storedBytes)
  return rec
}

// --- Listing (wiki page) ------------------------------------------------------

/** One live ROM as the wiki page lists it. */
export type ListingRow = {
  postId: string
  title: string
  uploaderName: string
  sizeBytes: number
  licence: string
  cgbFlag: number
  createdAt: number
}

/** Every live ROM, newest first. */
export async function listLiveRoms(): Promise<ListingRow[]> {
  const [ordered, rows] = await Promise.all([
    redis.zRange(key.library, 0, -1, {by: 'rank', reverse: true}),
    redis.hGetAll(key.listing),
  ])
  const out: ListingRow[] = []
  for (const {member} of ordered) {
    const raw = rows[member]
    if (!raw) continue
    try {
      out.push(JSON.parse(raw))
    } catch {}
  }
  return out
}

export async function countLiveRoms(): Promise<number> {
  return redis.zCard(key.library)
}

// --- Drafts (posts waiting for their ROM) ----------------------------------------

export type Draft = {
  postId: string
  authorId: string
  authorName: string
  title: string
  description: string
  createdAt: number
}

export async function createDraft(d: Draft): Promise<void> {
  await redis.hSet(key.draft(d.postId), {
    postId: d.postId,
    authorId: d.authorId,
    authorName: d.authorName,
    title: d.title,
    description: d.description,
    createdAt: `${d.createdAt}`,
  })
  await redis.zAdd(key.drafts, {member: d.postId, score: d.createdAt})
  await redis.set(key.userDraft(d.authorId), d.postId)
  await touchUser(d.authorId, d.createdAt)
}

export async function getDraft(postId: string): Promise<Draft | undefined> {
  const h = await redis.hGetAll(key.draft(postId))
  if (!h.postId || !h.authorId) return
  return {
    postId: h.postId,
    authorId: h.authorId,
    authorName: h.authorName ?? '',
    title: h.title ?? '',
    description: h.description ?? '',
    createdAt: Number(h.createdAt ?? 0),
  }
}

export async function getUserDraftPostId(
  userId: string,
): Promise<string | undefined> {
  return (await redis.get(key.userDraft(userId))) || undefined
}

/** Forgets a waiting post. Idempotent; returns the draft that was deleted. */
export async function deleteDraft(postId: string): Promise<Draft | undefined> {
  const draft = await getDraft(postId)
  await redis.del(key.draft(postId))
  await redis.zRem(key.drafts, [postId])
  if (draft && (await redis.get(key.userDraft(draft.authorId))) === postId)
    await redis.del(key.userDraft(draft.authorId))
  return draft
}

/** Post ids of drafts created at or before `before`. */
export async function listStaleDrafts(before: number): Promise<string[]> {
  const rows = await redis.zRange(key.drafts, 0, before, {by: 'score'})
  return rows.map(r => r.member)
}

// --- Battery saves -------------------------------------------------------------

function saveId(romId: string, userId: string): string {
  return `${romId}:${userId}`
}

export async function getSave(
  romId: string,
  userId: string,
): Promise<string | undefined> {
  return (await redis.get(key.save(romId, userId))) || undefined
}

/** Stores SRAM with a 180-day TTL and evicts the user's oldest saves past 20. */
export async function putSave(
  romId: string,
  userId: string,
  sramBase64: string,
  now: number = Date.now(),
): Promise<void> {
  const id = saveId(romId, userId)
  const oldSize = Number((await redis.hGet(key.saveSize, id)) ?? 0)
  const expiresAt = now + saveTtlMs

  await writeResult(async () => {
    await redis.set(key.save(romId, userId), sramBase64, {
      expiration: new Date(expiresAt),
    })
    await redis.hSet(key.saveSize, {[id]: `${sramBase64.length}`})
  })
  await redis.zAdd(key.saveIndex, {member: id, score: expiresAt})
  await redis.zAdd(key.romSavers(romId), {member: userId, score: now})
  await redis.zAdd(key.userSaves(userId), {member: romId, score: now})
  await addStorage(sramBase64.length - oldSize)
  await touchUser(userId, now)

  const count = await redis.zCard(key.userSaves(userId))
  if (count > maxSavesPerUser) {
    const oldest = await redis.zRange(
      key.userSaves(userId),
      0,
      count - maxSavesPerUser - 1,
      {by: 'rank'},
    )
    for (const {member} of oldest) await deleteSave(member, userId)
  }
}

export async function deleteSave(romId: string, userId: string): Promise<void> {
  const id = saveId(romId, userId)
  const size = Number((await redis.hGet(key.saveSize, id)) ?? 0)
  await redis.del(key.save(romId, userId))
  await redis.hDel(key.saveSize, [id])
  await redis.zRem(key.saveIndex, [id])
  await redis.zRem(key.romSavers(romId), [userId])
  await redis.zRem(key.userSaves(userId), [romId])
  await addStorage(-size)
}

/** Drops index entries (and storage bytes) for saves whose TTL lapsed. */
export async function sweepExpiredSaves(
  now: number = Date.now(),
): Promise<number> {
  const expired = await redis.zRange(key.saveIndex, 0, now, {by: 'score'})
  for (const {member} of expired) {
    const sep = member.indexOf(':')
    if (sep < 0) {
      await redis.zRem(key.saveIndex, [member])
      continue
    }
    await deleteSave(member.slice(0, sep), member.slice(sep + 1))
  }
  return expired.length
}

// --- Users ---------------------------------------------------------------------

export async function touchUser(
  userId: string,
  now: number = Date.now(),
): Promise<void> {
  await redis.zAdd(key.users, {member: userId, score: now})
}

/**
 * Deletes every ROM and save tied to a user (account deletion, spec §3.6).
 * Returns the deleted ROMs; the caller removes their posts.
 */
export async function deleteUserData(userId: string): Promise<RomRecord[]> {
  const deleted: RomRecord[] = []
  const roms = await redis.zRange(key.userRoms(userId), 0, -1, {by: 'rank'})
  for (const {member} of roms) {
    const rec = await deleteRom(member)
    if (rec) deleted.push(rec)
  }
  const saves = await redis.zRange(key.userSaves(userId), 0, -1, {by: 'rank'})
  for (const {member} of saves) await deleteSave(member, userId)
  await redis.del(key.userRoms(userId), key.userSaves(userId))
  await redis.zRem(key.users, [userId])
  await redis.hDel(key.sweepMissing, [userId])
  return deleted
}

// --- Blocklist -----------------------------------------------------------------

export async function getBlocklist(): Promise<{
  titles: string[]
  hashes: string[]
}> {
  const [titles, hashes] = await Promise.all([
    redis.hKeys(key.blockedTitles),
    redis.hKeys(key.blockedHashes),
  ])
  return {titles: titles.sort(), hashes: hashes.sort()}
}

/** Replaces one blocklist with `values` (already normalized). */
export async function setBlocklist(
  kind: 'title' | 'hash',
  values: string[],
): Promise<void> {
  const k = kind === 'title' ? key.blockedTitles : key.blockedHashes
  await redis.del(k)
  if (values.length) {
    const now = `${Date.now()}`
    await redis.hSet(k, Object.fromEntries(values.map(v => [v, now])))
  }
}

// --- Rate limiting -------------------------------------------------------------

/** Fixed-window limiter: returns false once `max` hits happen in the window. */
export async function hitRateLimit(
  kind: string,
  userId: string,
  max: number,
  windowSec: number,
): Promise<boolean> {
  const k = key.rateLimit(kind, userId)
  const n = await redis.incrBy(k, 1)
  if (n === 1) await redis.expire(k, windowSec)
  return n <= max
}
