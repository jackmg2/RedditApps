import assert from 'node:assert/strict'
import {test} from 'node:test'
import {makeRom, type RomSpec} from '../../test/fixtures.ts'
import {matchBlockedTitle, normalizeTitle} from './blocklist.ts'
import {isCommercialLicensee} from './licensees.ts'
import {
  hashSet,
  sha256Hex,
  type ValidateOptions,
  validateRom,
} from './validate.ts'

const opts: ValidateOptions = {
  fileName: 'game.gb',
  maxRomSize: 1024 * 1024,
  blockCommercialRoms: true,
  blockedTitles: [],
  blockedHashes: new Set(),
}

function check(spec: RomSpec, over: Partial<ValidateOptions> = {}) {
  return validateRom(makeRom(spec), {...opts, ...over})
}

function rejectCode(spec: RomSpec, over: Partial<ValidateOptions> = {}) {
  const v = check(spec, over)
  return v.ok ? 'OK' : v.code
}

test('accepts a well-formed homebrew ROM', () => {
  const v = check({
    title: 'MY HOMEBREW',
    cartType: 0x1b,
    ramSizeCode: 3,
    romSizeCode: 2,
  })
  assert.ok(v.ok)
  assert.equal(v.sha256.length, 64)
  assert.ok(v.notes.some(n => n.text.includes('MBC5+RAM+BATTERY')))
})

test('accepts 0x33 + "ZZ" new licensee', () => {
  assert.equal(rejectCode({oldLicensee: 0x33, newLicensee: 'ZZ'}), 'OK')
})

test('structural rejections (spec §4.1)', () => {
  assert.equal(rejectCode({}, {fileName: 'game.zip'}), 'REJECT_EXTENSION')
  for (const size of [256, 2304]) {
    const v = validateRom(new Uint8Array(size), opts)
    assert.equal(v.ok ? 'OK' : v.code, 'REJECT_BOOT_ROM')
  }
  assert.equal(rejectCode({size: 16 * 1024}), 'REJECT_SIZE')
  assert.equal(
    rejectCode({romSizeCode: 6}, {maxRomSize: 1024 * 1024}),
    'REJECT_SIZE',
  )
  assert.equal(
    rejectCode({size: 40 * 1024}),
    'REJECT_SIZE',
    'not a 16 KB multiple',
  )
  assert.equal(rejectCode({logo: false}), 'REJECT_NOT_GB')
  assert.equal(rejectCode({fixChecksum: false}), 'REJECT_HEADER_CHECKSUM')
  assert.equal(
    rejectCode({romSizeCode: 1, size: 32 * 1024}),
    'REJECT_ROM_SIZE_BYTE',
  )
  assert.equal(rejectCode({cartType: 0x04}), 'REJECT_CART_TYPE', 'unknown')
  assert.equal(
    rejectCode({cartType: 0x22}),
    'REJECT_CART_TYPE',
    'unsupported MBC7',
  )
})

test('warns, not rejects, on non-power-of-two padding', () => {
  // 48 KB with a size byte that can never match is still rejected by the
  // size-byte rule; the warning is recorded before that.
  const v = check({size: 48 * 1024})
  assert.equal(v.ok, false)
  assert.ok(v.notes.some(n => n.level === 'warn'))
})

test('accepts CGB-only ROMs', () => {
  assert.equal(rejectCode({cgbFlag: 0xc0}), 'OK')
})

test('commercial heuristics are only noted when not blocked', () => {
  const off = {blockCommercialRoms: false}
  const v = check({title: 'TETRIS', oldLicensee: 0x01}, off)
  assert.ok(v.ok)
  const warns = v.notes.filter(n => n.level === 'warn').map(n => n.text)
  assert.ok(warns.some(t => t.includes('0x01')))
  assert.ok(warns.some(t => t.includes('TETRIS')))
  assert.equal(
    rejectCode({title: 'MY GAME'}, {...off, blockedTitles: ['my game']}),
    'REJECT_TITLE',
    'mod-blocked titles still apply',
  )
  const rom = makeRom({title: 'BLOCKED HASH'})
  const h = validateRom(rom, {
    ...opts,
    ...off,
    blockedHashes: hashSet([sha256Hex(rom)]),
  })
  assert.equal(h.ok ? 'OK' : h.code, 'REJECT_HASH', 'mod-blocked hashes too')
})

test('commercial heuristics (spec §4.2)', () => {
  assert.equal(rejectCode({oldLicensee: 0x01}), 'REJECT_LICENSEE')
  assert.equal(
    rejectCode({oldLicensee: 0x33, newLicensee: '01'}),
    'REJECT_LICENSEE',
  )
  assert.equal(rejectCode({title: 'TETRIS'}), 'REJECT_TITLE')
  assert.equal(
    rejectCode({title: 'POKEMON RED'}),
    'REJECT_TITLE',
    'prefix entry',
  )
  assert.equal(rejectCode({title: 'Dr. Mario'}), 'REJECT_TITLE', 'normalized')
  assert.equal(
    rejectCode({title: 'MY GAME'}, {blockedTitles: ['my game']}),
    'REJECT_TITLE',
  )
  const rom = makeRom({title: 'BLOCKED HASH'})
  const v = validateRom(rom, {
    ...opts,
    blockedHashes: hashSet([sha256Hex(rom).toUpperCase()]),
  })
  assert.equal(v.ok ? 'OK' : v.code, 'REJECT_HASH')
})

test('global checksum mismatch is informational only', () => {
  const v = check({title: 'CHECKSUM'})
  assert.ok(v.ok)
  assert.ok(v.notes.some(n => n.text.startsWith('Global checksum')))
})

test('blocklist helpers', () => {
  assert.equal(normalizeTitle(' Dr. Mario! '), 'DRMARIO')
  assert.equal(matchBlockedTitle('', ['*']), undefined)
  assert.equal(matchBlockedTitle('KIRBY TILT', ['KIRBY*']), 'KIRBY*')
  assert.equal(matchBlockedTitle('MYKIRBY', ['KIRBY*']), undefined)
  assert.equal(isCommercialLicensee(0x00, '00'), false)
  assert.equal(isCommercialLicensee(0x33, 'zz'), false)
  assert.equal(isCommercialLicensee(0x33, 'a4'), true)
})
