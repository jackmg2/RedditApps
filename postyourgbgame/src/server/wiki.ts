import {context, reddit, type WikiPagePermissionLevel} from '@devvit/web/server'
import {isCgbAware, isCgbOnly} from '../shared/rom.ts'
import {getAppSettings} from './settings.ts'
import {type ListingRow, listLiveRoms} from './store/store.ts'

// WikiPagePermissionLevel.APPROVED_CONTRIBUTORS_ONLY — the enum is only
// type-exported through @devvit/web/server. With no contributors added, only
// moderators (and the app) can edit; everyone can still read the page.
const approvedContributorsOnly = 1 as WikiPagePermissionLevel

/** Keeps the page well under Reddit's wiki size limit. */
export const wikiRowLimit = 1500

/** Escapes Markdown that would break a table cell or a link label. */
export function escapeCell(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\\|[\]*_~`^]/g, '\\$&')
}

function system(cgbFlag: number): string {
  if (isCgbOnly(cgbFlag)) return 'GBC'
  return isCgbAware(cgbFlag) ? 'GB / GBC' : 'GB'
}

/** The whole wiki page: every live ROM, newest first. */
export function renderWikiPage(
  rows: readonly ListingRow[],
  subredditName: string,
): string {
  const lines = [
    '# Homebrew Game Boy ROMs',
    '',
    `Every homebrew game posted in r/${subredditName}, newest first. Open a post to play it.`,
    '',
    '*This page is kept up to date by the Homebrew GB Player app; manual edits are overwritten.*',
    '',
  ]
  if (!rows.length) {
    lines.push('*No ROMs have been posted yet.*')
    return `${lines.join('\n')}\n`
  }
  lines.push(
    '| Game | Author | System | Size | Licence | Posted |',
    '|:--|:--|:--|--:|:--|:--|',
  )
  for (const r of rows.slice(0, wikiRowLimit)) {
    const url = `https://www.reddit.com/r/${subredditName}/comments/${r.postId.replace(/^t3_/, '')}/`
    lines.push(
      `| [${escapeCell(r.title) || 'Untitled'}](${url}) | u/${r.uploaderName} | ${system(r.cgbFlag)} | ${Math.max(1, Math.round(r.sizeBytes / 1024))} KB | ${escapeCell(r.licence)} | ${new Date(r.createdAt).toISOString().slice(0, 10)} |`,
    )
  }
  lines.push('')
  lines.push(
    rows.length > wikiRowLimit
      ? `${rows.length} ROMs; the ${rows.length - wikiRowLimit} oldest are not listed.`
      : `${rows.length} ROM${rows.length === 1 ? '' : 's'}.`,
  )
  return `${lines.join('\n')}\n`
}

/**
 * Rewrites the ROM list wiki page from Redis. Best effort: a failure (wiki
 * disabled, Reddit error) is logged and never fails the caller. Each call
 * renders the full list, so the daily sweep repairs any missed update.
 */
export async function refreshWikiPage(): Promise<void> {
  const subredditName = context.subredditName
  try {
    const [{wikiPage: page}, rows] = await Promise.all([
      getAppSettings(),
      listLiveRoms(),
    ])
    const content = renderWikiPage(rows, subredditName)

    let current: string | undefined
    try {
      current = (await reddit.getWikiPage(subredditName, page)).content
    } catch {
      current = undefined
    }
    if (current === undefined) {
      await reddit.createWikiPage({
        subredditName,
        page,
        content,
        reason: 'Homebrew GB Player: ROM list created',
      })
      await reddit.updateWikiPageSettings({
        subredditName,
        page,
        listed: true,
        permLevel: approvedContributorsOnly,
      })
    } else if (current.trim() !== content.trim()) {
      await reddit.updateWikiPage({
        subredditName,
        page,
        content,
        reason: 'Homebrew GB Player: ROM list updated',
      })
    }
  } catch (err) {
    console.error('refreshWikiPage failed;', err)
  }
}
