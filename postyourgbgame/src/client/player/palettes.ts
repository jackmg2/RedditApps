export type Palette = {
  name: string
  /** Lightest shade first, as 0xRRGGBB. */
  shades: readonly [number, number, number, number]
}

const classic: Palette = {
  name: 'Classic',
  shades: [0x9bbc0f, 0x8bac0f, 0x306230, 0x0f380f],
}

/** DMG colour presets (spec §7.2). */
export const palettes: readonly Palette[] = [
  classic,
  {name: 'Pocket', shades: [0xc4cfa1, 0x8b956d, 0x4d533c, 0x1f1f1f]},
  {name: 'Grey', shades: [0xffffff, 0xaaaaaa, 0x555555, 0x000000]},
  {name: 'Mint', shades: [0xe0f8d0, 0x88c070, 0x346856, 0x081820]},
]

export function paletteAt(index: number): Palette {
  return palettes[index] ?? classic
}
