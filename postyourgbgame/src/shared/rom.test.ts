import assert from 'node:assert/strict'
import {test} from 'node:test'
import {makeRom} from '../test/fixtures.ts'
import {
  applyColourMode,
  computeHeaderChecksum,
  parseHeader,
  runsInCgbMode,
} from './rom.ts'

test('parses a valid header', () => {
  const header = parseHeader(
    makeRom({title: 'MY GAME', cartType: 0x03, ramSizeCode: 2, romSizeCode: 1}),
  )
  assert.ok(header)
  assert.equal(header.title, 'MY GAME')
  assert.equal(header.logoOk, true)
  assert.equal(header.cartType, 0x03)
  assert.equal(header.declaredRomSize, 64 * 1024)
  assert.equal(header.headerChecksum, header.computedHeaderChecksum)
})

test('CGB titles stop before the CGB flag', () => {
  const header = parseHeader(makeRom({title: 'ABCDEFGHIJKLMNO', cgbFlag: 0x80}))
  assert.equal(header?.title, 'ABCDEFGHIJKLMNO')
  assert.equal(header?.cgbFlag, 0x80)
})

test('too-small buffers have no header', () => {
  assert.equal(parseHeader(new Uint8Array(0x14f)), undefined)
})

test('detects a missing logo', () => {
  assert.equal(parseHeader(makeRom({logo: false}))?.logoOk, false)
})

test('applyColourMode patches 0x143 and keeps the checksum valid', () => {
  const rom = makeRom({cgbFlag: 0x80})
  const dmg = applyColourMode(rom, 'dmg')
  assert.equal(dmg[0x143], 0x00)
  assert.equal(dmg[0x14d], computeHeaderChecksum(dmg))
  assert.equal(rom[0x143], 0x80, 'input is not mutated')
  assert.equal(applyColourMode(rom, 'cgb')[0x143], 0x80)
  assert.equal(applyColourMode(rom, 'auto'), rom)
})

test('runsInCgbMode honours the hint', () => {
  assert.equal(runsInCgbMode(0x00, 'auto'), false)
  assert.equal(runsInCgbMode(0x80, 'auto'), true)
  assert.equal(runsInCgbMode(0xc0, 'dmg'), false)
  assert.equal(runsInCgbMode(0x00, 'cgb'), true)
})
