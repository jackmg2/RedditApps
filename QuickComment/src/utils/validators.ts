export function cleanUsername(raw: string): string {
  return raw.trim().replace(/^u\//i, '').trim();
}
