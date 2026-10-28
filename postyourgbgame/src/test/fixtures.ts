import {computeHeaderChecksum, nintendoLogo} from '../shared/rom.ts'

export type RomSpec = {
  title?: string
  /** File size in bytes; defaults to what romSizeCode declares. */
  size?: number
  romSizeCode?: number
  cartType?: number
  ramSizeCode?: number
  cgbFlag?: number
  oldLicensee?: number
  newLicensee?: string
  logo?: boolean
  fixChecksum?: boolean
  /** Distinguishes otherwise identical ROMs (changes the hash). */
  seed?: number
}

/**
 * A minimal valid cartridge: `nop; jp $0150` at the entry point and an
 * infinite `jr -2` loop, with a correct logo and header checksum.
 */
export function makeRom(spec: RomSpec = {}): Uint8Array {
  const romSizeCode = spec.romSizeCode ?? 0
  const rom = new Uint8Array(spec.size ?? 32 * 1024 * (1 << romSizeCode))
  rom.set([0x00, 0xc3, 0x50, 0x01], 0x100)
  if (spec.logo !== false) rom.set(nintendoLogo, 0x104)
  const title = spec.title ?? 'HOMEBREW'
  for (let i = 0; i < Math.min(title.length, 15); i++)
    rom[0x134 + i] = title.charCodeAt(i)
  rom[0x143] = spec.cgbFlag ?? 0
  const newLicensee = spec.newLicensee ?? '00'
  rom[0x144] = newLicensee.charCodeAt(0)
  rom[0x145] = newLicensee.charCodeAt(1)
  rom[0x147] = spec.cartType ?? 0
  rom[0x148] = romSizeCode
  rom[0x149] = spec.ramSizeCode ?? 0
  rom[0x14b] = spec.oldLicensee ?? 0
  rom.set([0x18, 0xfe], 0x150)
  rom[0x200] = spec.seed ?? 0
  rom[0x14d] = computeHeaderChecksum(rom)
  if (spec.fixChecksum === false) rom[0x14d] = (rom[0x14d] ?? 0) ^ 0xff
  return rom
}
