import {context, exitExpandedMode, navigateTo} from '@devvit/web/client'
import {
  apiPath,
  colourModes,
  licences,
  limits,
  type UploadConfigRsp,
  type UploadReq,
  type UploadRsp,
} from '../shared/api.ts'
import {
  type ColourMode,
  cartTypes,
  isCgbAware,
  isCgbOnly,
  minRomSize,
  parseHeader,
  type RomHeader,
} from '../shared/rom.ts'
import {api} from './lib/api.ts'
import {bytesToBase64} from './lib/base64.ts'
import {
  append,
  clear,
  el,
  formatBytes,
  modal,
  renderPlainText,
} from './lib/dom.ts'
import {captureCover} from './upload/cover.ts'

const root = document.getElementById('app') as HTMLElement

const colourLabels: {[M in ColourMode]: string} = {
  auto: 'Auto (from the ROM header)',
  dmg: 'Force original Game Boy',
  cgb: 'Force Game Boy Color',
}

// Expanded view of a post created from the "Post a homebrew ROM" menu: the
// post's author uploads its one and only ROM here.
async function init(): Promise<void> {
  clear(root)
  root.append(el('p', {class: 'muted center'}, 'Loading…'))
  const rsp = await api<UploadConfigRsp>('GET', apiPath.upload(context.postId))
  clear(root)
  if (!rsp.ok) {
    // 4xx: this post is not (or no longer) waiting for this user's ROM.
    const retryable = rsp.status === 0 || rsp.status >= 500
    root.append(
      el(
        'section',
        {class: 'page'},
        el('h1', {}, 'Upload your ROM'),
        el('p', {class: retryable ? 'error' : ''}, rsp.error.message),
        retryable
          ? el(
              'button',
              {type: 'button', on: {click: () => void init()}},
              'Retry',
            )
          : null,
      ),
    )
    return
  }
  const config = rsp.data
  if (await contentWarning(config)) renderForm(config)
  else {
    root.append(
      el(
        'section',
        {class: 'page'},
        el('p', {class: 'muted'}, 'Upload cancelled.'),
      ),
    )
  }
}

/** Content warning (spec §3.2), shown before every upload. */
async function contentWarning(config: UploadConfigRsp): Promise<boolean> {
  let accepted = false
  await modal(
    close => {
      const check = el('input', {type: 'checkbox', id: 'attest'})
      const ok = el(
        'button',
        {type: 'button', class: 'primary', disabled: true},
        'I understand',
      )
      check.addEventListener('change', () => {
        ok.disabled = !check.checked
      })
      ok.addEventListener('click', () => {
        accepted = check.checked
        close()
      })
      const cancel = el('button', {type: 'button'}, 'Cancel')
      cancel.addEventListener('click', ev => {
        close()
        try {
          exitExpandedMode(ev as MouseEvent)
        } catch {}
      })
      return el(
        'div',
        {class: 'warning'},
        el(
          'div',
          {class: 'warning-text'},
          renderPlainText(config.contentWarning),
        ),
        el('label', {class: 'check'}, check, ' I confirm the above'),
        el('div', {class: 'modal-actions'}, cancel, ok),
      )
    },
    {dismissable: false},
  )
  return accepted
}

type Picked = {file: File; bytes: Uint8Array; header: RomHeader | undefined}

function renderForm(config: UploadConfigRsp): void {
  let picked: Picked | undefined

  const file = el('input', {type: 'file', accept: '.gb,.gbc', required: true})
  const fileInfo = el('div', {class: 'file-info'})
  const licence = el('select')
  for (const l of licences) licence.append(el('option', {}, l))
  const sourceUrl = el('input', {
    type: 'url',
    placeholder: 'https://… (shown as plain text)',
  })
  sourceUrl.maxLength = limits.sourceUrlMax
  const colour = el('select')
  for (const m of colourModes) {
    const opt = el('option', {}, colourLabels[m])
    opt.value = m
    colour.append(opt)
  }
  const submit = el('button', {type: 'submit', class: 'primary'}, 'Upload ROM')
  const status = el('div', {class: 'upload-status', role: 'status'})

  file.addEventListener('change', () => {
    void (async () => {
      picked = undefined
      clear(fileInfo)
      const f = file.files?.[0]
      if (!f) return
      const bytes = new Uint8Array(await f.arrayBuffer())
      picked = {file: f, bytes, header: parseHeader(bytes)}
      renderFileInfo(fileInfo, picked, config)
    })()
  })

  const form = el(
    'form',
    {class: 'form page'},
    el('h1', {}, config.title),
    config.description ? el('p', {class: 'muted'}, config.description) : null,
    el(
      'p',
      {class: 'muted small'},
      'Once uploaded, the ROM cannot be changed. To post a different version, delete this post and create a new one.',
    ),
    el(
      'label',
      {},
      `ROM file (.gb or .gbc, max ${formatBytes(config.maxRomSizeKB * 1024)})`,
      file,
    ),
    fileInfo,
    el('label', {}, 'Licence of the ROM', licence),
    el('label', {}, 'Source / project link (optional)', sourceUrl),
    el('label', {}, 'Colour mode', colour),
    status,
    el('div', {class: 'form-actions'}, submit),
  )

  form.addEventListener('submit', ev => {
    ev.preventDefault()
    if (!picked) {
      showError(status, 'Pick a ROM file first.', config)
      return
    }
    const selection = picked
    submit.disabled = true
    void upload(
      selection,
      {
        licence: licence.value as UploadReq['licence'],
        sourceUrl: sourceUrl.value,
        colourMode: colour.value as ColourMode,
      },
      status,
      config,
    ).finally(() => {
      submit.disabled = false
    })
  })

  root.append(form)
}

function renderFileInfo(
  target: HTMLElement,
  picked: Picked,
  config: UploadConfigRsp,
): void {
  const {bytes, header, file} = picked
  const warnings: string[] = []
  const maxBytes = config.maxRomSizeKB * 1024
  if (!/\.gbc?$/i.test(file.name))
    warnings.push('The file must end in .gb or .gbc.')
  if (bytes.length < minRomSize || bytes.length > maxBytes)
    warnings.push(`Size must be between 32 KB and ${formatBytes(maxBytes)}.`)
  if (!header?.logoOk)
    warnings.push('This does not look like a Game Boy cartridge image.')
  else {
    if (header.headerChecksum !== header.computedHeaderChecksum)
      warnings.push(
        'The header checksum is wrong (fix it with rgbfix -v or your toolchain).',
      )
    if (header.declaredRomSize !== bytes.length)
      warnings.push('The header ROM size does not match the file size.')
  }

  const kind = header
    ? isCgbOnly(header.cgbFlag)
      ? 'Game Boy Color only'
      : isCgbAware(header.cgbFlag)
        ? 'Game Boy + Color enhanced'
        : 'Original Game Boy'
    : ''
  append(
    target,
    el(
      'p',
      {class: 'muted small'},
      `${file.name} · ${formatBytes(bytes.length)}`,
      header?.logoOk
        ? ` · "${header.title}" · ${kind} · ${cartTypes.get(header.cartType)?.name ?? 'unknown cartridge'}`
        : '',
    ),
    ...warnings.map(w => el('p', {class: 'error small'}, w)),
  )
}

function showError(
  target: HTMLElement,
  message: string,
  config: UploadConfigRsp,
  extra?: {code?: string; existingPostUrl?: string | undefined},
): void {
  clear(target)
  append(
    target,
    el('p', {class: 'error', role: 'alert'}, message),
    extra?.existingPostUrl
      ? el(
          'button',
          {
            type: 'button',
            on: {click: () => navigateTo(extra.existingPostUrl ?? '')},
          },
          'Open the existing post',
        )
      : null,
    extra?.code?.startsWith('REJECT_')
      ? el(
          'p',
          {class: 'muted small'},
          `Think this is a mistake? Message the mods of r/${config.subredditName}.`,
        )
      : null,
  )
}

async function upload(
  picked: Picked,
  fields: Pick<UploadReq, 'licence' | 'sourceUrl' | 'colourMode'>,
  status: HTMLElement,
  config: UploadConfigRsp,
): Promise<void> {
  clear(status)
  status.append(el('p', {class: 'muted'}, 'Capturing a cover screenshot…'))
  const cover = picked.header?.logoOk
    ? await captureCover(picked.bytes, fields.colourMode, picked.header.cgbFlag)
    : undefined

  clear(status)
  status.append(el('p', {class: 'muted'}, 'Uploading and checking the ROM…'))
  const body: UploadReq = {
    ...fields,
    fileName: picked.file.name,
    sizeBytes: picked.bytes.length,
    romBase64: bytesToBase64(picked.bytes),
    ...(cover && cover.length <= limits.coverMaxChars
      ? {coverDataUrl: cover}
      : {}),
    attested: true,
  }
  const rsp = await api<UploadRsp>('POST', apiPath.upload(context.postId), body)
  if (!rsp.ok) {
    showError(status, rsp.error.message, config, {
      code: rsp.error.error,
      existingPostUrl: rsp.error.existingPostUrl,
    })
    return
  }
  clear(status)
  status.append(el('p', {class: 'success'}, 'Uploaded! Opening your post…'))
  navigateTo(rsp.data.postUrl)
}

void init()
