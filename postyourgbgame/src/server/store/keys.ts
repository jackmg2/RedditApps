/** Redis key helpers (spec §5). Every key is namespaced with `hb:`. */
export const key = {
  romBin: (romId: string) => `hb:rom:${romId}:bin`,
  romMeta: (romId: string) => `hb:rom:${romId}:meta`,
  romCover: (romId: string) => `hb:rom:${romId}:cover`,
  /** zset userId → last save time; who has a battery save for this ROM. */
  romSavers: (romId: string) => `hb:rom:${romId}:savers`,
  /** postId → romId; claimed once per post, which makes the ROM immutable. */
  post: (postId: string) => `hb:post:${postId}`,
  /** hash; a post created from the menu that is still waiting for its ROM. */
  draft: (postId: string) => `hb:draft:${postId}`,
  /** zset postId → creation time; every waiting post, for the stale sweep. */
  drafts: 'hb:drafts',
  /** The user's waiting post, if any (one at a time). */
  userDraft: (userId: string) => `hb:user:${userId}:draft`,
  userRoms: (userId: string) => `hb:user:${userId}:roms`,
  /** zset romId → last save time; for the per-user save cap. */
  userSaves: (userId: string) => `hb:user:${userId}:saves`,
  /** zset userId → last activity; every user with data, for the account sweep. */
  users: 'hb:users',
  /** zset romId → creation time; every live ROM, for the wiki page. */
  library: 'hb:library',
  /** hash romId → JSON ListingRow; what the wiki page shows per ROM. */
  listing: 'hb:listing',
  hash: (sha256: string) => `hb:hash:${sha256}`,
  save: (romId: string, userId: string) => `hb:save:${romId}:${userId}`,
  /** zset "romId:userId" → expiry ms; lets the sweep account for TTL expiry. */
  saveIndex: 'hb:saveIndex',
  /** hash "romId:userId" → stored bytes. */
  saveSize: 'hb:saveSize',
  storageBytes: 'hb:stats:storageBytes',
  blockedTitles: 'hb:blocklist:titles',
  blockedHashes: 'hb:blocklist:hashes',
  rateLimit: (kind: string, userId: string) => `hb:rl:${kind}:${userId}`,
  sweepCursor: 'hb:sweep:cursor',
  /** hash userId → first time the account looked deleted. */
  sweepMissing: 'hb:sweep:missing',
} as const
