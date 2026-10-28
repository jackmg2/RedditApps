import type {ColourMode} from './rom.ts'

/** Error codes returned as `{error, message}` by every /api/* route. */
export type ErrorCode =
  | 'BAD_REQUEST'
  | 'LOGIN_REQUIRED'
  | 'NOT_ALLOWED'
  | 'ROM_LOCKED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'QUOTA_USER'
  | 'LIBRARY_FULL'
  | 'POST_FAILED'
  | 'SERVER_ERROR'
  | RejectCode

/** ROM validation rejections (spec §4). */
export type RejectCode =
  | 'REJECT_EXTENSION'
  | 'REJECT_SIZE'
  | 'REJECT_BOOT_ROM'
  | 'REJECT_NOT_GB'
  | 'REJECT_HEADER_CHECKSUM'
  | 'REJECT_ROM_SIZE_BYTE'
  | 'REJECT_CART_TYPE'
  | 'REJECT_LICENSEE'
  | 'REJECT_TITLE'
  | 'REJECT_HASH'
  | 'REJECT_DUPLICATE'

/** Generic error detail for all responses. */
export type ErrorRsp = {
  error: ErrorCode
  message: string
  /** Set for REJECT_DUPLICATE: the post that already hosts this ROM. */
  existingPostUrl?: string
}

export const licences = [
  'MIT',
  'GPL',
  'CC-BY',
  'CC0',
  'Other-free',
  'All rights reserved, author permission to host',
] as const
export type Licence = (typeof licences)[number]

export const colourModes: readonly ColourMode[] = ['auto', 'dmg', 'cgb']

export const limits = {
  titleMax: 100,
  descriptionMax: 500,
  sourceUrlMax: 300,
  /** Battery saves (SRAM) are capped at 128 KB raw. */
  saveMaxBytes: 128 * 1024,
  /** Auto-captured cover PNG data URL. */
  coverMaxChars: 64 * 1024,
} as const

/** Post data attached at post creation; kept tiny (ROM bytes never go here). */
export type RomPostData = {kind: 'rom'}

// --- Upload ------------------------------------------------------------------

/** Upload screen setup for a post that is still waiting for its ROM. */
export type UploadConfigRsp = {
  /** Post title and description, fixed when the post was created. */
  title: string
  description: string
  contentWarning: string
  maxRomSizeKB: number
  subredditName: string
}

export type UploadReq = {
  fileName: string
  sizeBytes: number
  licence: Licence
  sourceUrl: string
  colourMode: ColourMode
  romBase64: string
  /** PNG data URL of an auto-captured frame, if the client managed one. */
  coverDataUrl?: string
  attested: true
}

export type UploadRsp = {romId: string; postUrl: string}

// --- Player ------------------------------------------------------------------

/** ROM metadata safe to show any viewer. */
export type RomPublicMeta = {
  romId: string
  postId: string
  title: string
  description: string
  licence: string
  sourceUrl: string
  uploaderName: string
  createdAt: number
  sizeBytes: number
  headerTitle: string
  cartType: number
  cgbFlag: number
  sgbFlag: number
  colourMode: ColourMode
  hasCover: boolean
}

/** Inline view of a post: a playable ROM, or a post waiting for its ROM. */
export type RomMetaRsp =
  | {
      state: 'live'
      meta: RomPublicMeta
      cover: string | null
    }
  | {
      state: 'draft'
      title: string
      description: string
      authorName: string
      /** The viewer created this post and may upload its ROM. */
      isAuthor: boolean
    }

export type GetRomRsp = {meta: RomPublicMeta; romBase64: string}

export type GetSaveRsp = {sramBase64: string | null}
export type PutSaveReq = {sramBase64: string}
export type OkRsp = {ok: true}

// --- Moderation --------------------------------------------------------------

export type ValidationNote = {level: 'info' | 'warn'; text: string}

export type StorageInfo = {
  bytes: number
  limitBytes: number
  /** Soft warning to mods (≥ 80 %). */
  warn: boolean
  /** Uploads blocked (≥ 95 %). */
  blocked: boolean
}

// --- Routes ------------------------------------------------------------------

/** Client-side path builders for the /api/* routes. */
export const apiPath = {
  upload: (postId: string) => `/api/rom/${postId}/upload`,
  romMeta: (postId: string) => `/api/rom/${postId}/meta`,
  rom: (postId: string) => `/api/rom/${postId}`,
  save: (postId: string) => `/api/rom/${postId}/save`,
} as const

/** Devvit-invoked endpoints; must match devvit.json. */
export const Internal = {
  MenuUpload: '/internal/menu/upload',
  MenuBlocklist: '/internal/menu/blocklist',
  FormCreateRomPost: '/internal/form/create-rom-post',
  FormBlocklist: '/internal/form/blocklist',
  TriggerPostDelete: '/internal/trigger/post-delete',
  TriggerModAction: '/internal/trigger/mod-action',
  TriggerAppUpgrade: '/internal/trigger/app-upgrade',
  SchedulerAccountSweep: '/internal/scheduler/account-sweep',
  SchedulerRemovedPostsSweep: '/internal/scheduler/removed-posts-sweep',
  SchedulerDraftExpiry: '/internal/scheduler/draft-expiry',
  ValidateMaxRomSize: '/internal/settings/validate-max-rom-size',
  ValidateMaxRomsPerUser: '/internal/settings/validate-max-roms-per-user',
  ValidateWikiPage: '/internal/settings/validate-wiki-page',
} as const
