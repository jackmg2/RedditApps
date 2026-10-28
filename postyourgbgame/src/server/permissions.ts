import {context, reddit} from '@devvit/web/server'
import {getAppSettings} from './settings.ts'

export const uploadRefusal =
  'Only moderators and approved members can post ROMs here. The moderators control the list of allowed uploaders.'

/**
 * Parses the `allowedUsernames` setting: comma-separated, with or without
 * `u/`, case-insensitive, whitespace trimmed (spec §8.1).
 */
export function parseAllowedUsernames(raw: string): Set<string> {
  const out = new Set<string>()
  for (const part of raw.split(',')) {
    const name = part
      .trim()
      .replace(/^\/?u\//i, '')
      .toLowerCase()
    if (name) out.add(name)
  }
  return out
}

export type UploadDecision = {
  allowed: boolean
  isMod: boolean
  refusal?: string
}

/** Pure resolution order from spec §8.1. */
export function decideUpload(opts: {
  isMod: boolean
  allowEveryone: boolean
  allowedUsernames: string
  username: string | undefined
}): UploadDecision {
  const {isMod} = opts
  if (isMod) return {allowed: true, isMod}
  if (opts.allowEveryone) return {allowed: true, isMod}
  const name = opts.username?.toLowerCase()
  if (name && parseAllowedUsernames(opts.allowedUsernames).has(name))
    return {allowed: true, isMod}
  return {allowed: false, isMod, refusal: uploadRefusal}
}

/**
 * Whether the current user moderates this subreddit (any permission). Fails
 * closed. Specific mod permissions are checked with the toolkit's
 * checkModPermission on destructive routes.
 */
export async function isModerator(): Promise<boolean> {
  if (!context.userId) return false
  try {
    const user = await reddit.getCurrentUser()
    if (!user) return false
    const perms = await user.getModPermissionsForSubreddit(
      context.subredditName,
    )
    return perms.length > 0
  } catch (err) {
    console.error('isModerator: lookup failed;', err)
    return false
  }
}

/** Upload permission for the current user, evaluated server-side. */
export async function resolveUploadPermission(): Promise<UploadDecision> {
  if (!context.userId)
    return {allowed: false, isMod: false, refusal: 'Log in to post a ROM.'}
  const [isMod, appSettings] = await Promise.all([
    isModerator(),
    getAppSettings(),
  ])
  return decideUpload({
    isMod,
    allowEveryone: appSettings.allowEveryone,
    allowedUsernames: appSettings.allowedUsernames,
    username: context.username ?? (await currentUsername()),
  })
}

export async function currentUsername(): Promise<string | undefined> {
  if (context.username) return context.username
  try {
    return (await reddit.getCurrentUser())?.username
  } catch {
    return
  }
}
