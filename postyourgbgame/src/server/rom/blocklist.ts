/**
 * Header titles of commercial Game Boy / Game Boy Color releases (spec §4.2).
 * Titles are compared after normalizeTitle(); an entry ending in `*` matches
 * any title starting with it. Applied only while the `blockCommercialRoms`
 * setting is on; titles mods add with the `extraBlockedTitles` setting or the
 * "ROM blocklist" mod form always apply.
 */
export const builtinBlockedTitles: readonly string[] = [
  // Nintendo first-party and franchises.
  'TETRIS',
  'TETRIS DX',
  'TETRIS2',
  'TETRIS ATTACK',
  'TETRIS BLAST',
  'SUPER MARIOLAND',
  'MARIOLAND2',
  'SUPERMARIOLAND3',
  'MARIO DELUXE',
  'MARIO GOLF*',
  'MARIO TENNIS*',
  'DR.MARIO',
  'WARIOLAND*',
  'WARIO LAND*',
  'ZELDA*',
  'METROID2',
  'KIRBY*',
  'POKEMON*',
  'PM_CRYSTAL',
  'POKEPINBALL*',
  'TCG CARD',
  'DONKEY KONG*',
  'DONKEYKONGLAND*',
  'YOSHI*',
  'GAME&WATCH*',
  'GAME & WATCH*',
  'F1RACE',
  'ALLEY WAY',
  'SOLARSTRIKER',
  'RADARMISSION',
  'QIX',
  'BALLOON KID',
  'WAVE RACE',
  'STAR WARS*',
  'MEGAMAN*',
  'MEGA MAN*',
  'ROCKMAN*',
  'CASTLEVANIA*',
  'DRACULA*',
  'CONTRA*',
  'GARGOYLES QUEST',
  'FINAL FANTASY*',
  'FF LEGEND*',
  'DRAGON WARRIOR*',
  'DRAGONQUEST*',
  'MYSTIC QUEST',
  'SEIKEN DENSETSU',
  'BATMAN*',
  'TMNT*',
  'TURTLES*',
  'BOMBERMAN*',
  'PAC-MAN*',
  'PACMAN*',
  'GALAGA*',
  'LEMMINGS*',
  'PRINCE OF PERSIA',
  'HARVEST MOON*',
  'R-TYPE*',
  'DUCKTALES*',
  'SUPER R.C. PRO-AM',
  'MORTAL KOMBAT*',
  'STREET FIGHTER*',
  'RAYMAN',
  'SHANTAE',
]

/** Upper-case, alphanumerics only. "Dr. Mario" → "DRMARIO". */
export function normalizeTitle(title: string): string {
  return title.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** Splits a newline (or comma) separated setting into trimmed entries. */
export function parseList(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/[\n,]/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

/**
 * Returns the matching blocklist entry, if any. Each entry is normalized; a
 * trailing `*` makes it a prefix pattern. Empty normalized titles never match.
 */
export function matchBlockedTitle(
  title: string,
  entries: readonly string[],
): string | undefined {
  const norm = normalizeTitle(title)
  if (!norm) return
  for (const entry of entries) {
    const prefix = entry.trimEnd().endsWith('*')
    const pattern = normalizeTitle(entry)
    if (!pattern) continue
    if (prefix ? norm.startsWith(pattern) : norm === pattern) return entry
  }
  return
}

/** Lower-cased 64-hex-char SHA-256, or undefined if malformed. */
export function normalizeHash(hash: string): string | undefined {
  const h = hash.trim().toLowerCase()
  return /^[0-9a-f]{64}$/.test(h) ? h : undefined
}
