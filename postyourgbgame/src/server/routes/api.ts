import type {IncomingMessage} from 'node:http'
import {context, reddit} from '@devvit/web/server'
import type {T3} from '@devvit/web/shared'
import {
  colourModes,
  type GetRomRsp,
  type GetSaveRsp,
  licences,
  limits,
  type OkRsp,
  type PutSaveReq,
  type RomMetaRsp,
  type UploadConfigRsp,
  type UploadReq,
  type UploadRsp,
} from '../../shared/api.ts'
import type {ColourMode} from '../../shared/rom.ts'
import {ApiError, decodeBase64Strict, readJson} from '../http.ts'
import {isModerator, resolveUploadPermission} from '../permissions.ts'
import {parseList} from '../rom/blocklist.ts'
import {formatLicensee} from '../rom/licensees.ts'
import {hashSet, validateRom} from '../rom/validate.ts'
import {postUrl} from '../service.ts'
import {getAppSettings} from '../settings.ts'
import {
  attachPost,
  claimPost,
  countUserRoms,
  type Draft,
  findDuplicate,
  getBlocklist,
  getDraft,
  getRom,
  getRomBin,
  getRomCover,
  getRomIdForPost,
  getSave,
  getStorage,
  hitRateLimit,
  LibraryFullError,
  newRomId,
  publicMeta,
  putSave,
  type RomRecord,
  releasePost,
  storeRom,
} from '../store/store.ts'
import {refreshWikiPage} from '../wiki.ts'

function requireUser(): string {
  if (!context.userId)
    throw new ApiError(401, 'LOGIN_REQUIRED', 'Log in to do that.')
  return context.userId
}

/** Strips control characters (keeping newlines if asked) and trims. */
export function cleanText(value: unknown, keepNewlines = false): string {
  if (typeof value !== 'string') return ''
  let out = ''
  for (const ch of value) {
    const code = ch.charCodeAt(0)
    if (code >= 0x20 && code !== 0x7f) out += ch
    else if (keepNewlines) out += ch === '\n' ? ch : ''
    else out += ' '
  }
  return out.trim()
}

/** Accepts an empty string or an http(s) URL; returned as plain text. */
export function cleanSourceUrl(value: unknown): string | undefined {
  const s = cleanText(value)
  if (!s) return ''
  if (s.length > limits.sourceUrlMax) return
  try {
    const url = new URL(s)
    return url.protocol === 'http:' || url.protocol === 'https:' ? s : undefined
  } catch {
    return
  }
}

const coverRe = /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/

/** Requests are scoped to the post whose web view sends them (spec §10). */
function requireThisPost(postId: string): void {
  if (postId !== context.postId)
    throw new ApiError(403, 'FORBIDDEN', 'Wrong post for this request.')
}

async function liveRomForPost(postId: string): Promise<RomRecord> {
  requireThisPost(postId)
  const romId = await getRomIdForPost(postId)
  const rec = romId ? await getRom(romId) : undefined
  if (rec?.status !== 'live')
    throw new ApiError(404, 'UNAVAILABLE', 'This ROM is no longer available.')
  return rec
}

// --- Upload ------------------------------------------------------------------

/**
 * The post's draft, if the current user may upload its ROM now. A post gets
 * one ROM, ever: once uploaded it cannot be replaced, only deleted with the
 * post.
 */
async function draftForUpload(
  postId: string,
): Promise<{draft: Draft; userId: string}> {
  requireThisPost(postId)
  const userId = requireUser()
  if (await getRomIdForPost(postId))
    throw new ApiError(
      409,
      'ROM_LOCKED',
      'This post already has its ROM, and it cannot be changed. To post a different ROM, delete this post and create a new one.',
    )
  const draft = await getDraft(postId)
  if (!draft)
    throw new ApiError(404, 'NOT_FOUND', 'This post is not waiting for a ROM.')
  if (draft.authorId !== userId)
    throw new ApiError(
      403,
      'FORBIDDEN',
      `Only u/${draft.authorName} can upload the ROM for this post.`,
    )
  const perm = await resolveUploadPermission()
  if (!perm.allowed)
    throw new ApiError(403, 'NOT_ALLOWED', perm.refusal ?? 'Not allowed.')
  return {draft, userId}
}

export async function routeUploadConfig(
  postId: string,
): Promise<UploadConfigRsp> {
  const {draft} = await draftForUpload(postId)
  const appSettings = await getAppSettings()
  return {
    title: draft.title,
    description: draft.description,
    contentWarning: appSettings.contentWarningText,
    maxRomSizeKB: appSettings.maxRomSizeKB,
    subredditName: context.subredditName,
  }
}

export async function routeUpload(
  postId: string,
  req: IncomingMessage,
): Promise<UploadRsp> {
  const {draft, userId} = await draftForUpload(postId)
  const appSettings = await getAppSettings()
  const maxRomSize = appSettings.maxRomSizeKB * 1024
  const body = await readJson<Partial<UploadReq>>(
    req,
    Math.ceil((maxRomSize * 4) / 3) + limits.coverMaxChars + 64 * 1024,
  )

  if (body.attested !== true)
    throw new ApiError(
      400,
      'BAD_REQUEST',
      'Please confirm the content warning first.',
    )
  const licence = licences.find(l => l === body.licence)
  if (!licence) throw new ApiError(400, 'BAD_REQUEST', 'Pick a licence.')
  const sourceUrl = cleanSourceUrl(body.sourceUrl)
  if (sourceUrl === undefined)
    throw new ApiError(
      400,
      'BAD_REQUEST',
      'Source link must be an http(s) URL.',
    )
  const colourMode: ColourMode | undefined = colourModes.find(
    m => m === body.colourMode,
  )
  if (!colourMode) throw new ApiError(400, 'BAD_REQUEST', 'Pick a colour mode.')
  const fileName = cleanText(body.fileName)
  if (!fileName || fileName.length > 255)
    throw new ApiError(400, 'BAD_REQUEST', 'Missing file name.')
  if (!Number.isSafeInteger(body.sizeBytes) || (body.sizeBytes ?? 0) <= 0)
    throw new ApiError(400, 'BAD_REQUEST', 'Missing ROM size.')
  const bytes = decodeBase64Strict(body.romBase64, body.sizeBytes)
  if (!bytes || typeof body.romBase64 !== 'string')
    throw new ApiError(
      400,
      'BAD_REQUEST',
      'The ROM data is corrupt (length mismatch). Please try again.',
    )
  const romBase64 = body.romBase64
  const cover =
    typeof body.coverDataUrl === 'string' &&
    body.coverDataUrl.length <= limits.coverMaxChars &&
    coverRe.test(body.coverDataUrl)
      ? body.coverDataUrl
      : undefined

  if ((await countUserRoms(userId)) >= appSettings.maxRomsPerUser)
    throw new ApiError(
      403,
      'QUOTA_USER',
      `You have reached the limit of ${appSettings.maxRomsPerUser} ROMs in this subreddit. Delete an older ROM post first.`,
    )
  const storage = await getStorage()
  if (storage.blocked)
    throw new ApiError(
      507,
      'LIBRARY_FULL',
      'The ROM library is full. Please contact the moderators.',
    )

  const stored = await getBlocklist()
  const validation = validateRom(bytes, {
    fileName,
    maxRomSize,
    blockCommercialRoms: appSettings.blockCommercialRoms,
    blockedTitles: [
      ...parseList(appSettings.extraBlockedTitles),
      ...stored.titles,
    ],
    blockedHashes: hashSet(
      parseList(appSettings.extraBlockedHashes),
      stored.hashes,
    ),
  })
  if (!validation.ok)
    throw new ApiError(422, validation.code, validation.message)
  const {header, sha256} = validation

  const duplicateOf = await findDuplicate(sha256)
  if (duplicateOf !== undefined)
    throw new ApiError(
      409,
      'REJECT_DUPLICATE',
      'This ROM has already been posted here.',
      duplicateOf ? {existingPostUrl: postUrl(duplicateOf)} : {},
    )

  const now = Date.now()
  const username = context.username ?? draft.authorName
  const rec: RomRecord = {
    romId: newRomId(sha256),
    title: draft.title,
    description: draft.description,
    licence,
    sourceUrl,
    uploaderId: userId,
    uploaderName: username,
    postId,
    status: 'pending',
    sizeBytes: bytes.length,
    storedBytes: romBase64.length + (cover?.length ?? 0),
    sha256,
    cartType: header.cartType,
    cgbFlag: header.cgbFlag,
    sgbFlag: header.sgbFlag,
    licenseeCode: formatLicensee(header.oldLicensee, header.newLicensee),
    headerTitle: header.title,
    validation: validation.notes,
    attestedAt: now,
    attestedBy: username,
    createdAt: now,
    colourMode,
    hasCover: !!cover,
  }

  // The claim keeps the upload one-shot even if two requests race.
  if (!(await claimPost(postId, rec.romId)))
    throw new ApiError(
      409,
      'ROM_LOCKED',
      'This post already has its ROM, and it cannot be changed.',
    )
  try {
    if (!(await storeRom(rec, romBase64, cover)))
      throw new ApiError(
        409,
        'REJECT_DUPLICATE',
        'This ROM is being posted right now.',
      )
  } catch (err) {
    await releasePost(postId, rec.romId)
    if (err instanceof LibraryFullError)
      throw new ApiError(
        507,
        'LIBRARY_FULL',
        'The ROM library is full. Please contact the moderators.',
      )
    throw err
  }

  await attachPost(rec, postId)
  await refreshWikiPage()
  return {romId: rec.romId, postUrl: postUrl(postId)}
}

// --- Player --------------------------------------------------------------------

export async function routeRomMeta(postId: string): Promise<RomMetaRsp> {
  requireThisPost(postId)
  const romId = await getRomIdForPost(postId)
  const rec = romId ? await getRom(romId) : undefined
  if (rec?.status !== 'live') {
    const draft = await getDraft(postId)
    if (!draft)
      throw new ApiError(404, 'UNAVAILABLE', 'This ROM is no longer available.')
    return {
      state: 'draft',
      title: draft.title,
      description: draft.description,
      authorName: draft.authorName,
      isAuthor: !!context.userId && context.userId === draft.authorId,
    }
  }
  const cover = rec.hasCover ? await getRomCover(rec.romId) : undefined
  return {state: 'live', meta: publicMeta(rec), cover: cover ?? null}
}

export async function routeGetRom(postId: string): Promise<GetRomRsp> {
  const rec = await liveRomForPost(postId)
  const post = await reddit.getPostById(postId as T3)
  // Removed / queued posts stay playable for mods so they can review them.
  if (post.removed && !(await isModerator()))
    throw new ApiError(404, 'UNAVAILABLE', 'This ROM is no longer available.')
  const romBase64 = await getRomBin(rec.romId)
  if (!romBase64)
    throw new ApiError(404, 'UNAVAILABLE', 'This ROM is no longer available.')
  return {meta: publicMeta(rec), romBase64}
}

export async function routeGetSave(postId: string): Promise<GetSaveRsp> {
  const userId = requireUser()
  const rec = await liveRomForPost(postId)
  return {sramBase64: (await getSave(rec.romId, userId)) ?? null}
}

export async function routePutSave(
  postId: string,
  req: IncomingMessage,
): Promise<OkRsp> {
  const userId = requireUser()
  const rec = await liveRomForPost(postId)
  if (!(await hitRateLimit('save', userId, 40, 600)))
    throw new ApiError(
      429,
      'RATE_LIMITED',
      'Saving too often; try again shortly.',
    )
  const body = await readJson<Partial<PutSaveReq>>(
    req,
    Math.ceil((limits.saveMaxBytes * 4) / 3) + 1024,
  )
  const sram = decodeBase64Strict(body.sramBase64)
  if (
    !sram ||
    sram.length === 0 ||
    sram.length > limits.saveMaxBytes ||
    !body.sramBase64
  )
    throw new ApiError(400, 'BAD_REQUEST', 'Invalid save data (max 128 KB).')
  try {
    await putSave(rec.romId, userId, body.sramBase64)
  } catch (err) {
    if (err instanceof LibraryFullError)
      throw new ApiError(
        507,
        'LIBRARY_FULL',
        'Storage is full; your save could not be stored.',
      )
    throw err
  }
  return {ok: true}
}
