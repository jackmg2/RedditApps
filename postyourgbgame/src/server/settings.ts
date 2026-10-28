import {settings} from '@devvit/web/server'

/** Default content warning (spec §3.2); mods may replace it in settings. */
export const defaultContentWarning = `Before you upload

This community hosts homebrew only — games and demos made by their authors and shared with permission.

Do not upload:
- Commercial or licensed games (Nintendo or third-party), including ROM hacks of them
- Anything you did not create or do not have explicit permission to redistribute
- Boot ROMs / BIOS files
- Content that breaks Reddit's rules (hate, harassment, sexual content involving minors, etc.)

Uploads are checked automatically and reviewed by moderators. Infringing uploads are removed and may lead to a ban from this subreddit and a report to Reddit.

By continuing you confirm that you are the author of this ROM, or you have the author's permission to publish it here, and that it does not contain copyrighted code or assets you don't have rights to.`

export const settingRanges = {
  maxRomSizeKB: {min: 32, max: 4096, fallback: 1024},
  maxRomsPerUser: {min: 1, max: 100, fallback: 10},
} as const

export const defaultWikiPage = 'homebrew-roms'

/**
 * Wiki page names the app may overwrite: lower-case path segments. The wiki
 * index and Reddit's `config/` pages (sidebar, AutoModerator…) are refused
 * because the app replaces the whole page.
 */
export function wikiPageError(value: unknown): string | undefined {
  const page = typeof value === 'string' ? value.trim() : ''
  if (!/^[a-z0-9_-]+(\/[a-z0-9_-]+)*$/.test(page) || page.length > 100)
    return 'Use lower-case letters, digits, "-", "_" and "/" (for example homebrew-roms or games/homebrew).'
  if (page === 'index' || page === 'config' || page.startsWith('config/'))
    return 'This page is reserved by Reddit; choose another name.'
  return
}

export type AppSettings = {
  allowEveryone: boolean
  allowedUsernames: string
  maxRomSizeKB: number
  maxRomsPerUser: number
  extraBlockedTitles: string
  extraBlockedHashes: string
  blockCommercialRoms: boolean
  contentWarningText: string
  wikiPage: string
}

function clampInt(
  value: unknown,
  range: {min: number; max: number; fallback: number},
): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return range.fallback
  return Math.min(range.max, Math.max(range.min, Math.trunc(n)))
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Reads every subreddit setting, applying defaults and range clamps. */
export async function getAppSettings(): Promise<AppSettings> {
  const all = await settings.getAll<{[key: string]: unknown}>()
  return {
    allowEveryone: bool(all.allowEveryone, false),
    allowedUsernames: str(all.allowedUsernames),
    maxRomSizeKB: clampInt(all.maxRomSizeKB, settingRanges.maxRomSizeKB),
    maxRomsPerUser: clampInt(all.maxRomsPerUser, settingRanges.maxRomsPerUser),
    extraBlockedTitles: str(all.extraBlockedTitles),
    extraBlockedHashes: str(all.extraBlockedHashes),
    blockCommercialRoms: bool(all.blockCommercialRoms, true),
    contentWarningText:
      str(all.contentWarningText).trim() || defaultContentWarning,
    wikiPage: wikiPageError(all.wikiPage)
      ? defaultWikiPage
      : str(all.wikiPage).trim(),
  }
}

/** Settings-form validator for an integer range. */
export function validateRange(
  value: unknown,
  range: {min: number; max: number},
  label: string,
): {success: boolean; error?: string} {
  const n = Number(value)
  if (!Number.isInteger(n) || n < range.min || n > range.max)
    return {
      success: false,
      error: `${label} must be a whole number from ${range.min} to ${range.max}.`,
    }
  return {success: true}
}
