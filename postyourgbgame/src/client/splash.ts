import {context, requestExpandedMode} from '@devvit/web/client'
import {apiPath, type RomMetaRsp} from '../shared/api.ts'
import {isCgbAware, isCgbOnly} from '../shared/rom.ts'
import {api} from './lib/api.ts'
import {clear, el, formatBytes} from './lib/dom.ts'

// Inline feed view (spec §7.1): splash only — no WASM, no audio.
const root = document.getElementById('app') as HTMLElement

type LiveMeta = Extract<RomMetaRsp, {state: 'live'}>
type DraftMeta = Extract<RomMetaRsp, {state: 'draft'}>

/** Set while the post waits for its ROM, so returning to it re-checks. */
let waitingForRom = false

async function init(quiet = false): Promise<void> {
  if (!quiet) {
    clear(root)
    root.append(el('p', {class: 'muted center'}, 'Loading…'))
  }
  const rsp = await api<RomMetaRsp>('GET', apiPath.romMeta(context.postId))
  if (quiet && rsp.ok && rsp.data.state === 'draft') return
  clear(root)
  if (!rsp.ok) {
    root.append(
      el(
        'div',
        {class: 'splash-error'},
        el('p', {}, rsp.error.message),
        rsp.status === 404
          ? null
          : el(
              'button',
              {type: 'button', on: {click: () => void init()}},
              'Retry',
            ),
      ),
    )
    return
  }
  waitingForRom = rsp.data.state === 'draft'
  if (rsp.data.state === 'draft') renderDraft(rsp.data)
  else render(rsp.data)
}

// The upload screen opens on top of this view; refresh when it closes.
document.addEventListener('visibilitychange', () => {
  if (waitingForRom && document.visibilityState === 'visible') void init(true)
})
addEventListener('focus', () => {
  if (waitingForRom) void init(true)
})

/** A post created from the menu whose author has not uploaded the ROM yet. */
function renderDraft({
  title,
  description,
  authorName,
  isAuthor,
}: DraftMeta): void {
  let action: HTMLElement
  if (isAuthor) {
    action = el('button', {type: 'button', class: 'primary play'}, 'Upload ROM')
    action.addEventListener('click', ev =>
      requestExpandedMode(ev, 'upload', {title: 'Upload your ROM'}),
    )
  } else
    action = el(
      'p',
      {class: 'muted'},
      `Waiting for u/${authorName} to upload the ROM.`,
    )

  root.append(
    el(
      'article',
      {class: 'splash'},
      el('div', {class: 'cover placeholder', 'aria-hidden': 'true'}, 'GB'),
      el(
        'div',
        {class: 'splash-info'},
        el('h1', {}, title),
        description ? el('p', {class: 'description'}, description) : null,
        isAuthor
          ? el(
              'p',
              {class: 'muted small'},
              'Upload your .gb or .gbc file within an hour to make this post playable, or the post is removed. The ROM cannot be changed once uploaded.',
            )
          : null,
        action,
      ),
    ),
  )
}

function render({meta, cover}: LiveMeta): void {
  const art = cover
    ? el('img', {class: 'cover', alt: `${meta.title} screenshot`})
    : el('div', {class: 'cover placeholder', 'aria-hidden': 'true'}, 'GB')
  if (cover && art instanceof HTMLImageElement) art.src = cover

  const badge = isCgbOnly(meta.cgbFlag)
    ? 'Game Boy Color'
    : isCgbAware(meta.cgbFlag)
      ? 'Game Boy / Color'
      : 'Game Boy'

  const play = el('button', {type: 'button', class: 'primary play'}, '▶ Play')
  play.addEventListener('click', ev =>
    requestExpandedMode(ev, 'player', {title: meta.title}),
  )

  const description = meta.description
    ? el('p', {class: 'description'}, meta.description)
    : null

  root.append(
    el(
      'article',
      {class: 'splash'},
      art,
      el(
        'div',
        {class: 'splash-info'},
        el('h1', {}, meta.title),
        el(
          'p',
          {class: 'muted'},
          `by u/${meta.uploaderName} · ${badge} · ${formatBytes(meta.sizeBytes)}`,
        ),
        description,
        el(
          'p',
          {class: 'muted small'},
          `Licence: ${meta.licence}`,
          meta.sourceUrl ? ` · Source: ${meta.sourceUrl}` : '',
        ),
        play,
      ),
    ),
  )
}

void init()
