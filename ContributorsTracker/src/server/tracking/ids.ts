export function bareThingId(id: string): string {
  return id.replace(/^t[0-9]_/, "");
}

export function normalizeUsername(username: string): string {
  return username.trim().replace(/^u\//i, "").toLowerCase();
}

export function permalinkUrl(permalink: string): string {
  if (permalink.startsWith("http")) return permalink;
  return `https://www.reddit.com${permalink}`;
}

export function thingId<TPrefix extends "t1" | "t3">(
  id: string,
  prefix: TPrefix,
): `${TPrefix}_${string}` {
  return id.startsWith(`${prefix}_`)
    ? (id as `${TPrefix}_${string}`)
    : `${prefix}_${id}`;
}
