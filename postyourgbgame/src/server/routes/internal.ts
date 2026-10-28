import type {IncomingMessage} from 'node:http'
import {context, reddit} from '@devvit/web/server'
import type {
  SettingsValidationResponse,
  TriggerResponse,
  UiResponse,
} from '@devvit/web/shared'
import {limits, type RomPostData} from '../../shared/api.ts'
import {readJson} from '../http.ts'
import {currentUsername, resolveUploadPermission} from '../permissions.ts'
import {normalizeHash, parseList} from '../rom/blocklist.ts'
import {
  accountSweep,
  deletePostData,
  expireDraft,
  isAppPost,
  openDraftUrl,
  scheduleDraftExpiry,
} from '../service.ts'
import {
  getAppSettings,
  settingRanges,
  validateRange,
  wikiPageError,
} from '../settings.ts'
import {
  countLiveRoms,
  countUserRoms,
  createDraft,
  getBlocklist,
  getStorage,
  setBlocklist,
} from '../store/store.ts'
import {
  checkModPermission,
  permissionDeniedResponse,
} from '../toolkit/modPermissions.ts'
import {buildTitlePromptForm, extractTitle} from '../toolkit/postCreation.ts'
import {createRemovalSync} from '../toolkit/removalSync.ts'
import {cleanText} from './api.ts'

function toast(text: string, success = false): UiResponse {
  return {showToast: {text, appearance: success ? 'success' : 'neutral'}}
}

// --- Posting a ROM ---------------------------------------------------------------

/**
 * Checks shared by the menu and its form: upload rights, one waiting post
 * per user, and the per-user ROM quota. Returns the response that stops the
 * flow, or the user id to continue with.
 */
async function precheckNewRomPost(): Promise<
  {stop: UiResponse} | {userId: string}
> {
  const perm = await resolveUploadPermission()
  if (!perm.allowed) return {stop: toast(perm.refusal ?? 'Not allowed.')}
  const userId = context.userId
  if (!userId) return {stop: toast('Log in to post a ROM.')}
  const waiting = await openDraftUrl(userId)
  if (waiting)
    return {
      stop: {
        navigateTo: waiting,
        showToast: {
          text: 'You already have a post waiting for its ROM. Upload it there, or delete that post first.',
          appearance: 'neutral',
        },
      },
    }
  const {maxRomsPerUser} = await getAppSettings()
  if ((await countUserRoms(userId)) >= maxRomsPerUser)
    return {
      stop: toast(
        `You have reached the limit of ${maxRomsPerUser} ROMs in this subreddit. Delete an older ROM post first.`,
      ),
    }
  return {userId}
}

/**
 * Subreddit menu "Post a homebrew ROM": asks for the post title (Devvit
 * forms cannot take a ROM file), then creates the post; the ROM is uploaded
 * from the post itself.
 */
export async function onMenuUpload(): Promise<UiResponse> {
  const check = await precheckNewRomPost()
  if ('stop' in check) return check.stop
  return buildTitlePromptForm({
    formName: 'createRomPost',
    formTitle: 'Post a homebrew ROM',
    defaultTitle: '',
    helpText: `The name of your game (max ${limits.titleMax} characters). You upload the ROM in the post within an hour (or the post is removed); it cannot be changed afterwards.`,
    acceptLabel: 'Create post',
    extraFields: [
      {
        type: 'paragraph',
        name: 'description',
        label: `Short description (optional, max ${limits.descriptionMax} characters)`,
      },
    ],
  }) as UiResponse
}

export async function onFormCreateRomPost(
  req: IncomingMessage,
): Promise<UiResponse> {
  const check = await precheckNewRomPost()
  if ('stop' in check) return check.stop
  const body = await readJson<{description?: unknown}>(req)
  const title = cleanText(extractTitle(body, '')).slice(0, limits.titleMax)
  if (!title) return toast('A title is required.')
  const description = cleanText(body.description, true).slice(
    0,
    limits.descriptionMax,
  )
  const authorName = (await currentUsername()) ?? ''

  // The post always belongs to the uploader (spec §6.1); never app-authored.
  let post: Awaited<ReturnType<typeof reddit.submitCustomPost>>
  try {
    const postData: RomPostData = {kind: 'rom'}
    post = await reddit.submitCustomPost({
      subredditName: context.subredditName,
      title,
      entry: 'default',
      postData,
      runAs: 'USER',
      userGeneratedContent: {
        text: description ? `${title}\n\n${description}` : title,
      },
      textFallback: {
        text: `Homebrew Game Boy ROM: ${title}. Open this post in the Reddit app or on reddit.com to play it.`,
      },
    })
  } catch (err) {
    console.error('createRomPost: submitCustomPost failed;', err)
    return toast('Reddit did not accept the post. Please try again.')
  }

  const createdAt = Date.now()
  await createDraft({
    postId: post.id,
    authorId: check.userId,
    authorName,
    title,
    description,
    createdAt,
  })
  await scheduleDraftExpiry(post.id, createdAt)
  return {
    navigateTo: post.url,
    showToast: {
      text: 'Post created. Tap "Upload ROM" in it within an hour to add your game.',
      appearance: 'success',
    },
  }
}

// --- Moderation ----------------------------------------------------------------

const blocklistMax = 1000

/** Subreddit menu "ROM blocklist" (mods): edit both lists, see storage use. */
export async function onMenuBlocklist(): Promise<UiResponse> {
  const check = await checkModPermission(['posts'])
  if (!check.allowed) return permissionDeniedResponse(check)
  const [blocklist, storage, roms] = await Promise.all([
    getBlocklist(),
    getStorage(),
    countLiveRoms(),
  ])
  const mb = (n: number) => (n / 1024 / 1024).toFixed(1)
  return {
    showForm: {
      name: 'blocklist',
      form: {
        title: 'ROM blocklist',
        description: `Storage: ${mb(storage.bytes)} of ${mb(storage.limitBytes)} MB used by ${roms} ROM${roms === 1 ? '' : 's'} and battery saves${storage.blocked ? ' (full: uploads are blocked)' : storage.warn ? ' (almost full)' : ''}. The lists in the app settings also apply, plus the built-in commercial checks unless they are turned off in the app settings.`,
        acceptLabel: 'Save',
        fields: [
          {
            type: 'paragraph',
            name: 'titles',
            label: 'Blocked header titles',
            helpText:
              'One per line. Compared ignoring case and punctuation; end with * to block every title starting with it.',
            defaultValue: blocklist.titles.join('\n'),
          },
          {
            type: 'paragraph',
            name: 'hashes',
            label: 'Blocked ROM hashes',
            helpText: 'SHA-256, one per line.',
            defaultValue: blocklist.hashes.join('\n'),
          },
        ],
      },
    },
  } as UiResponse
}

export async function onFormBlocklist(
  req: IncomingMessage,
): Promise<UiResponse> {
  const check = await checkModPermission(['posts'])
  if (!check.allowed) return permissionDeniedResponse(check)
  const body = await readJson<{titles?: unknown; hashes?: unknown}>(req)
  const lines = (value: unknown) =>
    parseList(typeof value === 'string' ? value : '')

  const titles = [
    ...new Set(
      lines(body.titles)
        .map(t => cleanText(t).slice(0, 40))
        .filter(Boolean),
    ),
  ].slice(0, blocklistMax)
  const rawHashes = lines(body.hashes)
  const hashes = [
    ...new Set(rawHashes.map(normalizeHash).filter((h): h is string => !!h)),
  ].slice(0, blocklistMax)
  const invalid = rawHashes.filter(h => !normalizeHash(h)).length

  await setBlocklist('title', titles)
  await setBlocklist('hash', hashes)
  return toast(
    `Blocklist saved: ${titles.length} title${titles.length === 1 ? '' : 's'}, ${hashes.length} hash${hashes.length === 1 ? '' : 'es'}${invalid ? ` (${invalid} invalid hash${invalid === 1 ? '' : 'es'} ignored)` : ''}.`,
    true,
  )
}

// --- Triggers ------------------------------------------------------------------

/**
 * Removal sync (CLAUDE.md rule 1, spec §3.6): a ROM post (or one waiting for
 * its ROM) that is deleted or removed by a moderator loses its data, and the
 * wiki list drops it. The posts are the uploader's (runAs USER), so the
 * toolkit only runs cleanup for them.
 */
export const removalSync = createRemovalSync({
  isAppContent: e =>
    e.kind === 'post' ? isAppPost(e.targetId) : Promise.resolve(false),
  cleanup: e => deletePostData(e.targetId),
})

export async function onTriggerPostDelete(
  req: IncomingMessage,
): Promise<TriggerResponse> {
  return removalSync.handlePostDelete(await readJson(req))
}

export async function onTriggerModAction(
  req: IncomingMessage,
): Promise<TriggerResponse> {
  return removalSync.handleModAction(await readJson(req))
}

/**
 * The mod-action trigger only sees removals as they happen, and only for posts
 * that still have data. This sweep catches the rest: every removed post the
 * app account authored (older removals, expired drafts, posts whose data was
 * already gone) is deleted. Runs daily and on every app upgrade.
 */
export async function onSweepRemovedAppPosts(): Promise<TriggerResponse> {
  return removalSync.sweepRemovedAppPosts()
}

export async function onSchedulerAccountSweep(): Promise<TriggerResponse> {
  const result = await accountSweep()
  console.log(
    `accountSweep: checked ${result.checked}, deleted ${result.deletedUsers} users`,
  )
  return {}
}

/** One-off job, one hour after a post is created: no ROM yet → removed. */
export async function onSchedulerDraftExpiry(
  req: IncomingMessage,
): Promise<TriggerResponse> {
  const {data} = await readJson<{data?: {postId?: unknown}}>(req)
  if (typeof data?.postId === 'string') await expireDraft(data.postId)
  return {}
}

// --- Settings validation -------------------------------------------------------

export async function onValidateMaxRomSize(
  req: IncomingMessage,
): Promise<SettingsValidationResponse> {
  const {value} = await readJson<{value?: unknown}>(req)
  return validateRange(value, settingRanges.maxRomSizeKB, 'Max ROM size (KB)')
}

export async function onValidateMaxRomsPerUser(
  req: IncomingMessage,
): Promise<SettingsValidationResponse> {
  const {value} = await readJson<{value?: unknown}>(req)
  return validateRange(value, settingRanges.maxRomsPerUser, 'Max ROMs per user')
}

export async function onValidateWikiPage(
  req: IncomingMessage,
): Promise<SettingsValidationResponse> {
  const {value} = await readJson<{value?: unknown}>(req)
  const error = wikiPageError(value)
  return error ? {success: false, error} : {success: true}
}
