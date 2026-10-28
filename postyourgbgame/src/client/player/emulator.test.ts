import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {before, test} from 'node:test'
import {makeRom} from '../../test/fixtures.ts'
import {
  buttons,
  Emulator,
  screenHeight,
  screenWidth,
  ticksPerFrame,
} from './emulator.ts'

// Smoke test of the wrapper against the real vendored core (public/core/).
type Core = ConstructorParameters<typeof Emulator>[0]
let core: Core

before(async () => {
  const src = readFileSync(
    new URL('../../../public/core/binjgb.js', import.meta.url),
    'utf8',
  )
  const wasmBinary = readFileSync(
    new URL('../../../public/core/binjgb.wasm', import.meta.url),
  )
  // Test-only: evaluate the Emscripten factory without a DOM.
  const factory = new Function(`${src}; return Binjgb`)() as (
    opts: object,
  ) => Promise<Core>
  core = await factory({wasmBinary, locateFile: (p: string) => p})
})

test('runs frames and exposes the frame buffer', () => {
  const emu = new Emulator(core, makeRom(), 44100, 2048)
  let frames = 0
  emu.runUntil(10 * ticksPerFrame, () => frames++)
  assert.ok(frames > 0, 'no frames produced')
  assert.equal(emu.frameBuffer().length, screenWidth * screenHeight * 4)
  for (const b of buttons) emu.setButton(b, true)
  emu.setDmgPalette([0xffffff, 0xaaaaaa, 0x555555, 0x000000])
  emu.destroy()
})

test('battery RAM round-trips', () => {
  const emu = new Emulator(
    core,
    makeRom({cartType: 0x03, ramSizeCode: 0x02}),
    44100,
    2048,
  )
  assert.equal(emu.getSram().length, 8192)
  assert.equal(emu.setSram(new Uint8Array(8192).fill(5)), true)
  assert.equal(emu.getSram()[100], 5)
  assert.equal(emu.setSram(new Uint8Array(10)), false)
  emu.destroy()

  const plain = new Emulator(core, makeRom(), 44100, 2048)
  assert.equal(plain.getSram().length, 0)
  plain.destroy()
})

test('save states round-trip', () => {
  const emu = new Emulator(core, makeRom(), 44100, 2048)
  emu.runUntil(5 * ticksPerFrame)
  const state = emu.saveState()
  const ticks = emu.ticks
  emu.runUntil(20 * ticksPerFrame)
  assert.equal(emu.loadState(state), true)
  assert.equal(emu.ticks, ticks)
  assert.equal(emu.loadState(new Uint8Array(3)), false)
  emu.destroy()
})

test('recreating after destroy keeps the core heap intact', () => {
  // Regression: emulator_delete frees the ROM buffer; freeing it again
  // corrupted the heap and crashed the next emulator's save state (Reset).
  for (let i = 0; i < 3; i++) {
    const emu = new Emulator(core, makeRom(), 44100, 2048)
    emu.runUntil(3 * ticksPerFrame)
    assert.ok(emu.saveState().length > 0)
    emu.destroy()
  }
})
