export const REDIS_NAMESPACE = "tracking:v3";
export const DEFAULT_SCAN_LIMIT = 5000;
export const BACKFILL_CHUNK_SIZE = 100;
export const HISTORY_TABLE_LIMIT = 5;
export const MAX_HISTORY_COMMENT_UPDATES_PER_RUN = 25;
export const HISTORY_COMMENT_UPDATE_CONCURRENCY = 5;
export const USER_BACKFILL_LOCK_MS: number = 5 * 60 * 1000;
export const USER_BACKFILL_REFRESH_MS: number = 7 * 24 * 60 * 60 * 1000;
