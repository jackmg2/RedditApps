export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("&", " and ")
    .replace(/u\/[a-z0-9_-]+/g, " ")
    .replace(/r\/[a-z0-9_]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function nameAliases(name: string): string[] {
  const normalized = normalizeText(name);
  const aliases = new Set<string>([normalized, normalized.replace(/ and /g, " ")]);

  if (normalized.startsWith("the ")) {
    aliases.add(normalized.slice(4));
  }

  return [...aliases].filter(Boolean).sort();
}

export function extractContributors(...values: (string | undefined)[]): string[] {
  const usernames = new Set<string>();
  const text = values.filter(Boolean).join("\n");
  // Any u/ (or /u/) mention counts as a contributor; the "requested by" phrase
  // is no longer required. The lookbehind avoids matching mid-word (e.g. "menu/x").
  const pattern = /(?<![a-z0-9/])\/?u\/([a-z0-9_-]{3,20})/gi;

  for (const match of text.matchAll(pattern)) {
    if (match[1]) usernames.add(match[1]);
  }

  return [...usernames].sort((a, b) => a.localeCompare(b));
}

export function hasContributorUser(...values: (string | undefined)[]): boolean {
  return extractContributors(...values).length > 0;
}

// Backwards-compatible aliases while callsites migrate to neutral names.
export const extractrequestedBy: typeof extractContributors = extractContributors;
export const hasrequestedByUser: typeof hasContributorUser = hasContributorUser;

/**
 * Parses a moderator-entered free-text list of usernames (comma / whitespace /
 * newline separated, with or without a leading `u/` or `/u/`) into unique,
 * validated handles.
 */
export function parseUsernameList(input: string): string[] {
  const usernames = new Set<string>();

  for (const token of input.split(/[\s,]+/)) {
    const handle = token.replace(/^\/?u\//i, "").trim();
    if (/^[a-z0-9_-]{3,20}$/i.test(handle)) {
      usernames.add(handle);
    }
  }

  return [...usernames].sort((a, b) => a.localeCompare(b));
}

export function communityContributionNameFromTitle(title: string): string {
  const stripped = title
    .replace(
      /(?:[-\u2013\u2014|:()[\]\s]*)?(?:(?:requested\s*by|requestedby|requested-by)\s*:?\s*)?`?\s*\/?u\/[a-z0-9_-]{3,20}`?/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  return stripped || title;
}
