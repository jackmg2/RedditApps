/**
 * Game Boy cartridge header parsing. Pure and isomorphic: the server uses it
 * for validation, the client for upload-form UX and colour-mode patching.
 * Offsets and tables follow Pan Docs ("The Cartridge Header").
 */

/** Nintendo logo bitmap at 0x104–0x133, required by the hardware boot check. */
export const nintendoLogo: readonly number[] = [
  0xce, 0xed, 0x66, 0x66, 0xcc, 0x0d, 0x00, 0x0b, 0x03, 0x73, 0x00, 0x83, 0x00,
  0x0c, 0x00, 0x0d, 0x00, 0x08, 0x11, 0x1f, 0x88, 0x89, 0x00, 0x0e, 0xdc, 0xcc,
  0x6e, 0xe6, 0xdd, 0xdd, 0xd9, 0x99, 0xbb, 0xbb, 0x67, 0x63, 0x6e, 0x0e, 0xec,
  0xcc, 0xdd, 0xdc, 0x99, 0x9f, 0xbb, 0xb9, 0x33, 0x3e,
]

export const headerEnd = 0x150
export const romBankSize = 16 * 1024
export const minRomSize = 32 * 1024
/** DMG and CGB boot ROM image sizes; uploads of exactly these are rejected. */
export const bootRomSizes: readonly number[] = [256, 2304]

/** Cartridge types (0x147) with whether the bundled core can run them. */
export const cartTypes: ReadonlyMap<
  number,
  {name: string; supported: boolean}
> = new Map([
  [0x00, {name: 'ROM ONLY', supported: true}],
  [0x01, {name: 'MBC1', supported: true}],
  [0x02, {name: 'MBC1+RAM', supported: true}],
  [0x03, {name: 'MBC1+RAM+BATTERY', supported: true}],
  [0x05, {name: 'MBC2', supported: true}],
  [0x06, {name: 'MBC2+BATTERY', supported: true}],
  [0x08, {name: 'ROM+RAM', supported: true}],
  [0x09, {name: 'ROM+RAM+BATTERY', supported: true}],
  [0x0b, {name: 'MMM01', supported: true}],
  [0x0c, {name: 'MMM01+RAM', supported: true}],
  [0x0d, {name: 'MMM01+RAM+BATTERY', supported: true}],
  [0x0f, {name: 'MBC3+TIMER+BATTERY', supported: true}],
  [0x10, {name: 'MBC3+TIMER+RAM+BATTERY', supported: true}],
  [0x11, {name: 'MBC3', supported: true}],
  [0x12, {name: 'MBC3+RAM', supported: true}],
  [0x13, {name: 'MBC3+RAM+BATTERY', supported: true}],
  [0x19, {name: 'MBC5', supported: true}],
  [0x1a, {name: 'MBC5+RAM', supported: true}],
  [0x1b, {name: 'MBC5+RAM+BATTERY', supported: true}],
  [0x1c, {name: 'MBC5+RUMBLE', supported: true}],
  [0x1d, {name: 'MBC5+RUMBLE+RAM', supported: true}],
  [0x1e, {name: 'MBC5+RUMBLE+RAM+BATTERY', supported: true}],
  [0x20, {name: 'MBC6', supported: false}],
  [0x22, {name: 'MBC7+SENSOR+RUMBLE+RAM+BATTERY', supported: false}],
  [0xfc, {name: 'POCKET CAMERA', supported: false}],
  [0xfd, {name: 'BANDAI TAMA5', supported: false}],
  [0xfe, {name: 'HuC3', supported: false}],
  [0xff, {name: 'HuC1+RAM+BATTERY', supported: true}],
])

export type RomHeader = {
  /** Header title, printable ASCII, trimmed. */
  title: string
  /** True when 0x104–0x133 matches the Nintendo logo. */
  logoOk: boolean
  /** 0x143. 0x80 = CGB-enhanced, 0xC0 = CGB-only. */
  cgbFlag: number
  /** 0x146. 0x03 = SGB functions. */
  sgbFlag: number
  /** 0x147. */
  cartType: number
  /** 0x148. */
  romSizeCode: number
  /** ROM size the header declares, or undefined for an invalid code. */
  declaredRomSize: number | undefined
  /** 0x149. */
  ramSizeCode: number
  /** 0x14B. */
  oldLicensee: number
  /** 0x144–0x145 as ASCII; meaningful only when oldLicensee === 0x33. */
  newLicensee: string
  /** 0x14D as stored. */
  headerChecksum: number
  /** Header checksum computed over 0x134–0x14C. */
  computedHeaderChecksum: number
  /** 0x14E–0x14F as stored (big-endian). */
  globalChecksum: number
  /** Sum of all bytes except 0x14E–0x14F, truncated to 16 bits. */
  computedGlobalChecksum: number
}

export function isCgbOnly(cgbFlag: number): boolean {
  return cgbFlag === 0xc0
}

export function isCgbAware(cgbFlag: number): boolean {
  return cgbFlag === 0x80 || cgbFlag === 0xc0
}

export function computeHeaderChecksum(rom: Uint8Array): number {
  let x = 0
  for (let i = 0x134; i <= 0x14c; i++) x = (x - (rom[i] ?? 0) - 1) & 0xff
  return x
}

/** Returns undefined when the buffer is too small to hold a header. */
export function parseHeader(rom: Uint8Array): RomHeader | undefined {
  if (rom.length < headerEnd) return
  const at = (i: number): number => rom[i] ?? 0

  let logoOk = true
  for (let i = 0; i < nintendoLogo.length; i++)
    if (at(0x104 + i) !== nintendoLogo[i]) logoOk = false

  const cgbFlag = at(0x143)
  // CGB carts reuse 0x143 (and often 0x13F–0x142) inside the title area.
  const titleEnd = isCgbAware(cgbFlag) ? 0x143 : 0x144
  let title = ''
  for (let i = 0x134; i < titleEnd; i++) {
    const c = at(i)
    if (c === 0) break
    title += c >= 0x20 && c < 0x7f ? String.fromCharCode(c) : ' '
  }

  const romSizeCode = at(0x148)
  let globalSum = 0
  for (let i = 0; i < rom.length; i++)
    if (i !== 0x14e && i !== 0x14f) globalSum = (globalSum + at(i)) & 0xffff

  return {
    title: title.trim(),
    logoOk,
    cgbFlag,
    sgbFlag: at(0x146),
    cartType: at(0x147),
    romSizeCode,
    declaredRomSize:
      romSizeCode <= 0x08 ? minRomSize << romSizeCode : undefined,
    ramSizeCode: at(0x149),
    oldLicensee: at(0x14b),
    newLicensee: String.fromCharCode(at(0x144), at(0x145)),
    headerChecksum: at(0x14d),
    computedHeaderChecksum: computeHeaderChecksum(rom),
    globalChecksum: (at(0x14e) << 8) | at(0x14f),
    computedGlobalChecksum: globalSum,
  }
}

export type ColourMode = 'auto' | 'dmg' | 'cgb'

/**
 * Returns a copy of the ROM with 0x143 rewritten to force DMG or CGB mode and
 * the header checksum fixed up. The core picks the hardware model from 0x143,
 * so this is how the colour-mode hint is applied. 'auto' returns the input.
 */
export function applyColourMode(rom: Uint8Array, mode: ColourMode): Uint8Array {
  if (mode === 'auto' || rom.length < headerEnd) return rom
  const out = rom.slice()
  out[0x143] = mode === 'cgb' ? 0x80 : 0x00
  out[0x14d] = computeHeaderChecksum(out)
  return out
}

/** Whether the core will run this ROM in CGB mode under the given hint. */
export function runsInCgbMode(cgbFlag: number, mode: ColourMode): boolean {
  if (mode === 'dmg') return false
  if (mode === 'cgb') return true
  return isCgbAware(cgbFlag)
}
