import {
  applyColourMode,
  type ColourMode,
  runsInCgbMode,
} from '../../shared/rom.ts'
import {audioFrames} from '../player/audio.ts'
import {
  Emulator,
  loadCore,
  screenHeight,
  screenWidth,
  ticksPerFrame,
} from '../player/emulator.ts'
import {paletteAt} from '../player/palettes.ts'

/** True when every pixel has the same colour (blank / fade screens). */
function isFlat(rgba: Uint8Array): boolean {
  for (let i = 4; i < rgba.length; i += 4)
    if (
      rgba[i] !== rgba[0] ||
      rgba[i + 1] !== rgba[1] ||
      rgba[i + 2] !== rgba[2]
    )
      return false
  return true
}

/**
 * Runs the ROM headless for a few seconds of game time and returns a PNG data
 * URL of the first non-blank frame, for the post's cover thumbnail. Returns
 * undefined on any failure; the splash then shows a placeholder.
 */
export async function captureCover(
  rom: Uint8Array,
  mode: ColourMode,
  cgbFlag: number,
): Promise<string | undefined> {
  try {
    const core = await loadCore()
    const emu = new Emulator(
      core,
      applyColourMode(rom, mode),
      44100,
      audioFrames,
    )
    try {
      if (!runsInCgbMode(cgbFlag, mode)) emu.setDmgPalette(paletteAt(0).shades)
      let frame: Uint8Array | undefined
      // Sample from ~3 s to ~10 s; yield between samples to keep the UI alive.
      for (let f = 180; f <= 600 && !frame; f += 60) {
        emu.runUntil(f * ticksPerFrame)
        const fb = emu.frameBuffer()
        if (!isFlat(fb)) frame = fb.slice()
        await new Promise(resolve => setTimeout(resolve))
      }
      frame ??= emu.frameBuffer().slice()

      const canvas = document.createElement('canvas')
      canvas.width = screenWidth
      canvas.height = screenHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const image = ctx.createImageData(screenWidth, screenHeight)
      image.data.set(frame)
      ctx.putImageData(image, 0, 0)
      return canvas.toDataURL('image/png')
    } finally {
      emu.destroy()
    }
  } catch (err) {
    console.error('cover capture failed;', err)
    return
  }
}
