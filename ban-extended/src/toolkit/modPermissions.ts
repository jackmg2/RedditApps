// Copied from _shared/toolkit — do not edit in the app.
// Edit c:\Dev\02_RedditApps\_shared\toolkit and run: node ../_shared/sync-toolkit.mjs sync --all
//
// Rule 4: moderation tools must verify the acting moderator holds the specific
// mod permission for the action, not just that they are a moderator.
// Reddit permission mapping: ban/approve USERS -> 'access'; remove/approve
// CONTENT -> 'posts'; user/post flair -> 'flair'; wiki pages -> 'wiki'.

import { context, reddit } from "@devvit/web/server";

export type ModPermission =
  | "all"
  | "wiki"
  | "posts"
  | "access"
  | "mail"
  | "config"
  | "flair"
  | "chat_operator"
  | "chat_config"
  | "channels"
  | "community_chat";

export type PermissionCheck =
  | { allowed: true; username: string; permissions: ModPermission[] }
  | { allowed: false; username?: string | undefined; reason: string; missing: ModPermission[] };

/**
 * Checks that the current user moderates the subreddit with every permission
 * in `required` (or 'all'). Fails closed: any lookup failure, missing user, or
 * non-moderator resolves to { allowed: false } — it never throws.
 */
export async function checkModPermission(
  required: ModPermission[],
  subredditName?: string,
): Promise<PermissionCheck> {
  const subreddit = subredditName ?? context.subredditName;
  if (!subreddit) {
    return { allowed: false, reason: "Could not resolve subreddit", missing: required };
  }

  let username: string | undefined;
  try {
    const user = await reddit.getCurrentUser();
    username = user?.username;
    if (!user || !username) {
      return { allowed: false, reason: "Could not resolve current user", missing: required };
    }

    const permissions = (await user.getModPermissionsForSubreddit(
      subreddit,
    )) as ModPermission[];
    if (permissions.includes("all")) {
      return { allowed: true, username, permissions };
    }
    const missing = required.filter((p) => !permissions.includes(p));
    if (missing.length === 0) {
      return { allowed: true, username, permissions };
    }
    return {
      allowed: false,
      username,
      reason:
        permissions.length === 0
          ? `u/${username} is not a moderator of r/${subreddit}`
          : `u/${username} is missing mod permission(s): ${missing.join(", ")}`,
      missing,
    };
  } catch (err) {
    console.error("checkModPermission: lookup failed;", err);
    return { allowed: false, username, reason: "Permission lookup failed", missing: required };
  }
}

export class ModPermissionError extends Error {
  readonly check: PermissionCheck;

  constructor(check: PermissionCheck & { allowed: false }) {
    super(check.reason);
    this.name = "ModPermissionError";
    this.check = check;
  }
}

/** Throw-style variant of checkModPermission for service-layer guards. */
export async function assertModPermission(
  required: ModPermission[],
  subredditName?: string,
): Promise<{ username: string }> {
  const check = await checkModPermission(required, subredditName);
  if (!check.allowed) throw new ModPermissionError(check);
  return { username: check.username };
}

/**
 * UiResponse-shaped denial for menu/form handlers; return it with HTTP 200.
 */
export function permissionDeniedResponse(
  check: PermissionCheck,
): { showToast: string } {
  const detail = check.allowed
    ? ""
    : check.missing.length > 0
      ? ` You need the "${check.missing.join('", "')}" mod permission(s).`
      : ` ${check.reason}.`;
  return { showToast: `Not allowed.${detail}` };
}
