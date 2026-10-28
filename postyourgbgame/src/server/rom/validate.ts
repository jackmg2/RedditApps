import {createHash} from 'node:crypto'
import type {RejectCode, ValidationNote} from '../../shared/api.ts'
import {
  bootRomSizes,
  cartTypes,
  minRomSize,
  parseHeader,
  type RomHeader,
  romBankSize,
} from '../../shared/rom.ts'
import {
  builtinBlockedTitles,
  matchBlockedTitle,
  normalizeHash,
} from './blocklist.ts'
import {formatLicensee, isCommercialLicensee} from './licensees.ts'

export type ValidateOptions = {
  fileName: string
  maxRomSize: number
  /**
   * Refuse commercial licensee codes and built-in commercial titles; when off
   * they are only noted. Mod-blocked titles and hashes always apply.
   */
  blockCommercialRoms: boolean
  /** Mod-added title entries (the built-in list is applied separately). */
  blockedTitles: readonly string[]
  blockedHashes: ReadonlySet<string>
}

export type Validation =
  | {ok: true; header: RomHeader; sha256: string; notes: ValidationNote[]}
  | {ok: false; code: RejectCode; message: string; notes: ValidationNote[]}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function hex(n: number, width = 2): string {
  return `0x${n.toString(16).padStart(width, '0')}`
}

/**
 * Deterministic server-side checks from spec §4.1–4.2, in order. Duplicate
 * detection (§4.3) needs storage and is done by the caller.
 */
export function validateRom(
  bytes: Uint8Array,
  opts: ValidateOptions,
): Validation {
  const notes: ValidationNote[] = []
  const reject = (code: RejectCode, message: string): Validation => ({
    ok: false,
    code,
    message,
    notes,
  })
  const size = bytes.length

  if (!/\.gbc?$/i.test(opts.fileName.trim()))
    return reject(
      'REJECT_EXTENSION',
      'Only .gb and .gbc files can be uploaded.',
    )

  if (bootRomSizes.includes(size))
    return reject(
      'REJECT_BOOT_ROM',
      'This looks like a boot ROM / BIOS, not a cartridge image. Boot ROMs cannot be uploaded.',
    )

  if (size < minRomSize || size > opts.maxRomSize)
    return reject(
      'REJECT_SIZE',
      `ROM size must be between ${minRomSize / 1024} KB and ${Math.floor(opts.maxRomSize / 1024)} KB (this one is ${(size / 1024).toFixed(1)} KB).`,
    )

  if (size % romBankSize !== 0)
    return reject('REJECT_SIZE', 'ROM size must be a multiple of 16 KB.')
  if ((size & (size - 1)) !== 0)
    notes.push({
      level: 'warn',
      text: `Size ${size} bytes is not a power of two (padding mismatch).`,
    })

  const header = parseHeader(bytes)
  if (!header?.logoOk)
    return reject(
      'REJECT_NOT_GB',
      'Not a Game Boy ROM: the cartridge header logo is missing (boot ROM or not a cartridge image).',
    )

  if (header.headerChecksum !== header.computedHeaderChecksum)
    return reject(
      'REJECT_HEADER_CHECKSUM',
      `Header checksum mismatch (stored ${hex(header.headerChecksum)}, computed ${hex(header.computedHeaderChecksum)}). Fix the header with your toolchain (e.g. rgbfix -v).`,
    )

  if (header.declaredRomSize !== size)
    return reject(
      'REJECT_ROM_SIZE_BYTE',
      `The header ROM size byte (${hex(header.romSizeCode)}) does not match the file size (${size} bytes).`,
    )

  const cart = cartTypes.get(header.cartType)
  if (!cart)
    return reject(
      'REJECT_CART_TYPE',
      `Unknown cartridge type ${hex(header.cartType)}.`,
    )
  if (!cart.supported)
    return reject(
      'REJECT_CART_TYPE',
      `Cartridge type ${cart.name} is not supported by the player.`,
    )
  notes.push({level: 'info', text: `Cartridge: ${cart.name}`})

  const allowed =
    'accepted because this subreddit does not block commercial ROMs.'
  const licensee = formatLicensee(header.oldLicensee, header.newLicensee)
  if (isCommercialLicensee(header.oldLicensee, header.newLicensee)) {
    if (opts.blockCommercialRoms)
      return reject(
        'REJECT_LICENSEE',
        `This looks like a commercial release (licensee code ${licensee}).`,
      )
    notes.push({
      level: 'warn',
      text: `Licensee code ${licensee} belongs to a commercial publisher; ${allowed}`,
    })
  } else notes.push({level: 'info', text: `Licensee code: ${licensee}`})

  if (matchBlockedTitle(header.title, builtinBlockedTitles)) {
    if (opts.blockCommercialRoms)
      return reject(
        'REJECT_TITLE',
        `The header title "${header.title}" matches a commercial game on the blocklist.`,
      )
    notes.push({
      level: 'warn',
      text: `Header title "${header.title}" matches a commercial game; ${allowed}`,
    })
  }

  if (matchBlockedTitle(header.title, opts.blockedTitles))
    return reject(
      'REJECT_TITLE',
      `The header title "${header.title}" has been blocked by the moderators.`,
    )

  const sha256 = sha256Hex(bytes)
  if (opts.blockedHashes.has(sha256))
    return reject('REJECT_HASH', 'This ROM has been blocked by the moderators.')

  if (header.globalChecksum !== header.computedGlobalChecksum)
    notes.push({
      level: 'info',
      text: `Global checksum mismatch (stored ${hex(header.globalChecksum, 4)}, computed ${hex(header.computedGlobalChecksum, 4)}); informational only.`,
    })

  return {ok: true, header, sha256, notes}
}

/** Builds the blocked-hash set from settings and stored entries. */
export function hashSet(...lists: readonly (readonly string[])[]): Set<string> {
  const out = new Set<string>()
  for (const list of lists)
    for (const raw of list) {
      const h = normalizeHash(raw)
      if (h) out.add(h)
    }
  return out
}
