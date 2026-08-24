# RedditRatio (Ratio Bot) - Functional Specification

This document describes the current behavior of the RedditRatio Devvit app (`ratio-bobo`, v0.0.15) as implemented in `redditratio/src/`. It is intended as a reference for migrating the app to a newer Devvit framework version while preserving the same data model and behavior.

## 1. Overview

RedditRatio is a Reddit moderation bot that tracks, per user, a ratio between:

- **Regular posts** - posts without one of the configured "monitored" flairs.
- **Monitored posts** - posts whose flair matches one of the configured "monitored flairs".

The app enforces a configurable ratio between these two counts and can automatically remove posts that would violate the ratio. It supports two enforcement modes:

- **Normal mode** (default): users may make `ratioValue` regular posts for every 1 monitored post.
  - Violation condition: `regularPosts > ratioValue * monitoredPosts`
- **Inverted mode**: users must make `ratioValue` regular posts to "earn" 1 monitored post.
  - Violation condition: `monitoredPosts > floor(regularPosts / ratioValue)`

The user's current counts are displayed in their subreddit user flair as `[regularPosts/monitoredPosts]`, appended to whatever flair text already exists.

## 2. Data Model (Redis)

All persistent state is stored in Devvit's Redis (`context.redis`), accessed via `redisService` (`src/services/redisService.ts`).

| Key | Type | Format / Value | Notes |
|---|---|---|---|
| `<userId>` (e.g. `t2_abc123`) | string | `"<regularPosts>/<monitoredPosts>"` | Default `"0/1"` if not set. Read with `getUserRatio`, written with `setUserRatio`. |
| `posts` | string (JSON) | JSON-serialized array of `PostRecord` | Global, app-wide history of all tracked post events, used to regenerate the wiki page. Read/written via `getPostRecords` / `savePostRecords` / `addPostRecord`. |
| `app_removed:<postId>` | string | `"true"` | Set with a 1-hour expiration when the app removes a post for a ratio violation. Used by the `PostDelete` trigger to distinguish app-initiated removals from user/mod deletions. Cleared via `clearAppRemovedMarker` once consumed. |

### `PostRecord` (`src/types/PostRecord.ts`)

```ts
interface PostRecord {
  authorName: string;
  date: string;       // ISO date, "YYYY-MM-DD"
  postTitle: string;
  postLink: string;
  ratio: string;       // e.g. "3/1", "EXEMPT", "VIOLATION - NO RATIO CHANGE"
}
```

## 3. App Settings (`src/config/settings.ts` / `src/types/AppSettings.ts`)

| Setting | Type | Default | Description |
|---|---|---|---|
| `invertedRatio` | boolean | `false` | Toggles between Normal mode and Inverted mode (see formulas above). |
| `ratioValue` | number | `3` | The ratio multiplier used in both modes. |
| `monitoredFlair` | string | `"Your post flair;Your second post flair"` | Semicolon-separated list of flair text values that count as "monitored" posts. |
| `exemptUsers` | string | `""` | Semicolon-separated usernames exempt from ratio enforcement and flair display (case-insensitive). |
| `decreaseMonitoredOnRemoval` | boolean | `true` | If true, deleting a post with a monitored flair decrements the user's monitored count. |
| `decreaseRegularOnRemoval` | boolean | `true` | If true, deleting a regular post decrements the user's regular count. |
| `ratioViolationComment` | paragraph | `"Your post has been removed due to exceeding the allowed post ratio."` | Comment posted (and distinguished as mod) when a post is removed for violating the ratio. Empty string = no comment. |
| `wrongFlairComment` | paragraph | `""` | Comment posted when a moderator changes a post's flair from a monitored flair back to a regular (non-monitored) flair. Empty string = no comment. |

## 4. Core Services

### 4.1 `RatioService` (`src/services/ratioService.ts`)

- **`getUserRatio(userId, context)`** -> `[regularPosts, monitoredPosts]`
  Reads the `<userId>` Redis key and splits `"X/Y"` into numbers.

- **`updateUserRatio(regularPosts, monitoredPosts, userId, context)`**
  1. Always writes the new counts to Redis (`<userId>` = `"regular/monitored"`), regardless of exempt status.
  2. Looks up the username and checks `exemptUsers`. If exempt, stops here (no flair update).
  3. Otherwise, builds `ratio = "[regular/monitored]"`.
  4. Fetches the user's current subreddit flair text, strips any trailing `[\d+/\d+]` pattern via regex, appends the new `[regular/monitored]` ratio, and calls `setUserFlair` with the same `cssClass` as before.
  5. Display format is **always** `[regular/monitored]` regardless of mode (Normal vs Inverted only changes the *meaning*/violation formula, not the display).

- **`checkRatioViolation(regularPosts, monitoredPosts, ratioValue, invertedRatio)`** -> boolean
  - Inverted mode: `monitoredPosts > Math.floor(regularPosts / ratioValue)`
  - Normal mode: `regularPosts > ratioValue * monitoredPosts`

- **`removePostForViolation(postId, violationComment, context)`**
  1. Marks the post as app-removed in Redis (`app_removed:<postId>`, 1h TTL) **before** removing it.
  2. If `violationComment` is non-empty, submits it as a distinguished (mod) comment on the post.
  3. Removes the post via `context.reddit.remove(postId, false)` (not marked as spam).

### 4.2 `FlairUtils` (`src/utils/flairUtils.ts`)

- **`getMonitoredFlairs(settings)`** - splits `monitoredFlair` setting on `;`, trims, filters empty.
- **`isMonitoredFlair(flairText, monitoredFlairs)`** - true if `flairText` is defined and is in the monitored list.
- **`updatePostFlair(context, postId, newFlair)`**
  - If `newFlair === ''`, removes the post's flair entirely.
  - Else, looks up the subreddit's post flair templates for one matching `newFlair` text:
    - If found, applies the template (id, text, background/text colors).
    - If not found, sets a plain custom flair with just the text (no template).

### 4.3 `ExemptUserUtils` (`src/utils/exemptUserUtils.ts`)

- **`getExemptUsers(settings)`** - splits `exemptUsers` on `;`, trims, lowercases, filters empty.
- **`isExemptUser(username, exemptUsers)`** - case-insensitive membership check.

### 4.4 `WikiService` (`src/services/wikiService.ts`)

- **`recordPost(context, postRecord)`**
  - Appends `postRecord` to the global `posts` list in Redis, then regenerates the entire wiki page from the full list.

- **`updateWikiPage(context, posts)`**
  - Wiki page name: **`redditratio`** (in the current subreddit).
  - Groups all `PostRecord`s by `authorName`.
  - Sorts authors alphabetically.
  - Within each author's section, sorts posts by `date` descending (newest first).
  - Page content format:
    ```
    # Post History by User

    This page is automatically generated and tracks all posts with their ratio changes.

    ## <author1>

    * <date>: [<postTitle>](<postLink>) - Ratio: <ratio>
    * ...

    ## <author2>
    ...
    ```
  - If the page doesn't exist, creates it (`reason: 'Automatic creation by RedditRatio'`); otherwise updates it (`reason: 'Automatic update by RedditRatio'`).

## 5. Triggers

### 5.1 `PostSubmit` (`src/triggers/postSubmit.ts`)

On every new post:

1. Load settings, resolve author username.
2. **If author is exempt:**
   - Record a `PostRecord` with `ratio: "EXEMPT"`, `postTitle` = the post's title (or "Untitled"), `postLink` = `https://www.reddit.com<permalink>`. Return (no ratio enforcement, no flair update).
3. **Otherwise:**
   - Get current `[regularPosts, monitoredPosts]`.
   - Determine if the post's `linkFlair.text` is a monitored flair.
   - Compute hypothetical new counts:
     - If monitored: `regularPosts` unchanged, `monitoredPosts + 1`.
     - If regular: `regularPosts + 1`, `monitoredPosts` unchanged.
   - Run `checkRatioViolation` with the new counts.
     - **If it would violate:** call `removePostForViolation` (marks app-removed, optional comment, removes post). User's ratio is **not** updated (the violating post does not count).
     - **If OK:** call `updateUserRatio` with the new counts (updates Redis + flair), then record a `PostRecord` with `ratio = "newRegular/newMonitored"`, `postTitle` = post title, `postLink` = permalink URL.

### 5.2 `PostDelete` (`src/triggers/postDelete.ts`)

On post deletion:

1. Fetch the post by `event.postId`.
2. **Check `app_removed:<postId>` marker:**
   - If set (the app itself removed this post for a violation):
     - Clear the marker.
     - Record a `PostRecord`: `postTitle = "[APP REMOVED] <title>"`, `ratio = "VIOLATION - NO RATIO CHANGE"`.
     - Return early - **no ratio adjustment**.
3. **Otherwise (genuine user/mod deletion):**
   - Resolve author from `event.author.id`. If not found, log error and return.
   - **If author is exempt:**
     - Record a `PostRecord`: `postTitle = "[DELETED] <title>"`, `ratio = "EXEMPT"`. Return.
   - **Otherwise:**
     - Get current `[regularPosts, monitoredPosts]`.
     - Determine if the deleted post's `flair.text` was a monitored flair.
     - Adjust counts based on settings:
       - If it was monitored and `decreaseMonitoredOnRemoval` is true: `monitoredPosts = max(0, monitoredPosts - 1)`.
       - If it was regular and `decreaseRegularOnRemoval` is true: `regularPosts = max(0, regularPosts - 1)`.
       - (If the corresponding setting is false, that count is left unchanged.)
     - Call `updateUserRatio` with the adjusted counts (updates Redis + flair).
     - Record a `PostRecord`: `postTitle = "[USER DELETED] <title>"`, `ratio = "newRegular/newMonitored"`.

## 6. Moderator Tools (Menu Items)

### 6.1 Post-context menu items

- **"Ratio: Manually set user ratio"** (`menuItems/manualRatio.ts`, mods only)
  - Loads the post's author and their current ratio.
  - Opens `manualRatioModificationModal` (`forms/manualRatioForm.ts`) pre-filled with `userId`, `regularPosts`, `monitoredPosts`.
  - On submit: calls `RatioService.updateUserRatio(regularCount, monitoredCount, userId, context)`. Shows a toast. **Does not** write a wiki record.

- **"Ratio: Change flair and update ratio"** (`menuItems/changeFlairAndRatio.ts`, mods only)
  - Loads the post, author, and the list of monitored flairs from settings (plus a "No flair" option).
  - Opens `changeFlairAndRatioModal` (`forms/changeFlairForm.ts`) showing the current flair (read-only) and a select of possible new flairs.
  - On submit (`FlairService.updateFlairAndRatio`, `services/flairService.ts`):
    1. Updates the post's flair via `FlairUtils.updatePostFlair` (template-based if a matching template exists, else plain text; empty selection removes the flair). If this fails, aborts with a toast.
    2. If the user is exempt: shows a toast and stops (no ratio change).
    3. Otherwise, gets current `[regularPosts, monitoredPosts]` and reclassifies based on old vs new flair's monitored status:
       - Regular -> Monitored: `regularPosts - 1` (floored at 0), `monitoredPosts + 1`.
       - Monitored -> Regular: `regularPosts + 1`, `monitoredPosts - 1` (floored at 0). If `wrongFlairComment` is non-empty, posts it as a distinguished comment.
       - No change in classification: counts unchanged.
    4. Runs `checkRatioViolation` on the new counts:
       - **If violating:** marks post as app-removed, calls `removePostForViolation` (comment + remove), shows a toast, and records a `PostRecord` with `postTitle = "[FLAIR CHANGE - VIOLATION] Post ID: <id>"`, `ratio = "VIOLATION - NO RATIO CHANGE"`. The user's ratio is **not** updated.
       - **If OK:** calls `updateUserRatio` with new counts, shows a toast, and records a `PostRecord` with `postTitle = '[FLAIR CHANGE] From "<old>" to "<new>"'`, `ratio = "newRegular/newMonitored"`.

- **"Ratio: Remove flair"** (`menuItems/removeFlair.ts`, mods only)
  - If the post currently has no flair, shows a toast and stops.
  - Otherwise calls `FlairService.updateFlairAndRatio(context, userId, currentFlair, '', postId)` - i.e., the same logic as "Change flair" above, with the new flair set to empty (treated as "Monitored -> Regular" if the current flair was monitored).

### 6.2 Subreddit-context menu items

- **"Ratio: Set User Ratio by Username"** (`menuItems/setRatioByUsername.ts`, mods only)
  - Opens `setUserRatioByUsernameModal` (`forms/setRatioByUsernameForm.ts`) with fields: `username` (string, required), `regularCount` (number, default 0, required), `monitoredCount` (number, default 1, required).
  - On submit:
    1. Resolves the username to a user ID via `getUserByUsername`. If not found, shows a toast and stops.
    2. Calls `RatioService.updateUserRatio(regularCount, monitoredCount, userId, context)`.
    3. Records a `PostRecord` with `postTitle = "[MANUAL ADJUSTMENT]"`, `postLink` = subreddit URL, and **note**: `ratio` is recorded as `"<monitoredCount>/<regularCount>"` (monitored-first), which is the **reverse order** from the `[regular/monitored]` convention used everywhere else - this appears to be an existing inconsistency/bug to be aware of during migration.
    4. Shows a toast confirming the new ratio.

- **"Ratio: Refresh Wiki"** (`menuItems/refreshWiki.ts`, mods only)
  - Reads all `PostRecord`s from Redis (`posts` key). If empty, shows a toast and stops.
  - Otherwise calls `WikiService.updateWikiPage` to regenerate the `redditratio` wiki page from the full history.

## 7. App Configuration

- **App name**: `ratio-bobo` (from `devvit.yaml`), version `0.0.15`.
- **Devvit capabilities enabled** (`src/main.tsx`):
  - `redditAPI: true`
  - `redis: true`
- **Registered triggers**: `PostSubmit`, `PostDelete`.
- **Registered menu items**: Manual ratio (post), Change flair and update ratio (post), Remove flair (post), Refresh wiki (subreddit), Set ratio by username (subreddit).
- **Settings**: registered via `Devvit.addSettings(settings)`.

## 8. Key Behavioral Invariants (for migration verification)

1. Posts removed for violating the ratio do **not** change the user's stored ratio or flair.
2. The `app_removed:<postId>` marker (1h TTL) is the mechanism that prevents the `PostDelete` trigger from double-adjusting ratios when the app's own removal subsequently triggers a delete event.
3. User flair always reflects `[regularPosts/monitoredPosts]` appended to any pre-existing flair text (with any prior `[n/n]` suffix stripped first), except for exempt users, whose flair is never modified by this app.
4. Exempt status is determined by case-insensitive username match against the `exemptUsers` setting; exempt users still have their Redis counts updated, but no flair changes and ratio display is suppressed.
5. The wiki page (`redditratio`) is a full regeneration from the entire `posts` history on every recorded event, grouped by author (alphabetical) and sorted by date (descending) within each author.
6. Ratio violation formulas differ by mode (Normal vs Inverted) - see Section 1/4.1 - but the on-flair display format `[regular/monitored]` is mode-independent.
