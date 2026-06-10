# BanExtended — Full Application Specification

## Context
The existing BanExtended app (v0.0.20) was built with an older Devvit API. The API has evolved and the app must be rebuilt from scratch. This document is a complete specification derived from the current source code so that no feature or behavior is lost in the migration.

---

## 1. App Identity

| Property | Value |
|---|---|
| App name (devvit.yaml) | `ban-extended` |
| Reddit API | Enabled |
| HTTP requests | Disabled |
| Target users | Subreddit moderators |

---

## 2. Purpose

BanExtended is a moderator-only Devvit app that streamlines banning users and removing their content. It is designed to help mods combat flood campaigns and spam by providing:
- A one-click ban flow from any post or comment (single user)
- A bulk ban form for banning many users at once
- An export tool to copy the subreddit's full ban list (semicolon-separated, for synchronizing bans across communities)

---

## 3. App Settings (Global / Subreddit-Level)

Two configurable defaults are stored in Devvit app settings. They pre-populate forms so mods don't have to repeat common choices.

| Setting | Type | Options |
|---|---|---|
| Default Ban Duration | select | Permanent, 1 day, 3 days, 7 days, 30 days |
| Default Content Removal Period | select | Do not remove, Last 24 hours, Previous 3 days, Previous 7 days, All time |

---

## 4. Menu Items

### 4.1 Ban User and Remove Content
- **Location**: Post context menu AND Comment context menu
- **Visibility**: Moderators only (`forUserType: 'moderator'`)
- **Label**: `"Ban User and Remove Content"`
- **Trigger flow**:
  1. Detect whether the trigger came from a post or comment
  2. Fetch the author (User object) from the post/comment ID
  3. Fetch the current subreddit name
  4. Fetch the subreddit's removal reasons list
  5. Load app settings to get default ban duration and default removal period
  6. Open the **Ban User Form** with all fields pre-populated

### 4.2 Bulk Ban Users
- **Location**: Subreddit settings menu
- **Visibility**: Moderators only
- **Label**: `"Ban Extended: Bulk Ban Users"`
- **Trigger flow**:
  1. Fetch the current subreddit name
  2. Fetch the subreddit's removal reasons list
  3. Validate that removal reasons exist — if none, show an error alert and abort
  4. Load app settings for defaults
  5. Open the **Bulk Ban Form**

### 4.3 Export Banned Users
- **Location**: Subreddit settings menu
- **Visibility**: Moderators only
- **Label**: `"Ban Extended: Export Banned Users"`
- **Trigger flow**:
  1. Show a loading toast: `"Fetching banned users..."`
  2. Fetch the current subreddit name
  3. Call `reddit.getBannedUsers({ subredditName }).all()` to get every banned user
  4. Format the result as a semicolon-separated string of usernames
  5. Open the **Export Banned Users Form**
  6. Handle the empty-list case gracefully (show the form with an empty/zero-total state)

---

## 5. Forms

### 5.1 Ban User Form
**Title**: `"Ban {username}"`

| Field | Type | Required | Notes |
|---|---|---|---|
| `subRedditName` | string | yes | Disabled (auto-populated) |
| `username` | string | yes | Disabled (auto-populated from post/comment author) |
| `banDuration` | select | yes | Options: Permanent, 1 day, 3 days, 7 days, 30 days. Default from app settings |
| `ruleViolated` | select | no | Options populated from subreddit removal reasons |
| `banMessage` | string | no | Custom message sent to the banned user |
| `removeContent` | select | no | Options: Do not remove, Last 24 hours, Previous 3 days, Previous 7 days, All time. Default from app settings |
| `markAsSpam` | boolean | no | Toggle — marks removed content as spam |

**On submit**: Call `BanService.processBan(values, context)`

---

### 5.2 Bulk Ban Form
**Title**: `"Bulk Ban Users"`

| Field | Type | Required | Notes |
|---|---|---|---|
| `subRedditName` | string | yes | Disabled (auto-populated) |
| `usernames` | paragraph | yes | Semicolon-separated list, e.g. `user1;user2;user3` |
| `banDuration` | select | yes | Same options as 5.1. Default from app settings |
| `ruleViolated` | select | yes | Populated from subreddit removal reasons |
| `banMessage` | string | no | Sent to every banned user |
| `removeContent` | select | no | Same options as 5.1 |
| `markAsSpam` | boolean | no | Marks removed content as spam |

**Submit button label**: `"Ban All Users"`
**On submit**: Call `BanService.processBulkBan(values, context)`

---

### 5.3 Export Banned Users Form
**Title**: `"Banned Users ({total} total)"`

| Field | Type | Notes |
|---|---|---|
| `bannedUsersList` | paragraph | Read-only (disabled). Contains semicolon-separated usernames |

**Purpose**: Display-only. Mods copy the list for use in another community.
**Submit button label**: `"Done"`
**No actual processing on submit.**

---

## 6. Data Models

### 6.1 BanEvent
```
banDuration:    number | undefined   // undefined = permanent
ruleViolated:   string               // truncated to 100 chars before sending to Reddit API
banMessage:     string
removeContent:  string               // time-period string or 'Do not remove'
markAsSpam:     boolean
username:       string
subRedditName:  string
```
Includes a static `fromJson()` deserializer.

### 6.2 AppSettings
```
defaultBanDuration:    string   // select value
defaultRemoveContent:  string   // select value
```

### 6.3 BanFormData
Combines user/subreddit info + subreddit rules + AppSettings defaults.
Used to pass data from menu item handler into the form.

---

## 7. Services

### 7.1 BanService

#### `banUser(context, banEvent)`
Calls `context.reddit.banUser()` with:
- `subredditName`, `username`
- `duration` (undefined for permanent, number of days otherwise)
- `reason` = `banEvent.ruleViolated.substring(0, 100)`
- `note` = `banEvent.banMessage`

#### `removeUserContent(context, username, subredditName, markAsSpam, timePeriod)`
1. Fetch all user posts via `reddit.getPostsByUser({ username }).all()`
2. Fetch all user comments via `reddit.getCommentsByUser({ username }).all()`
3. Filter both lists by subreddit AND by creation date within the time period:

| `timePeriod` value | Max age |
|---|---|
| `"Last 24 hours"` | 86 400 000 ms |
| `"Previous 3 days"` | 259 200 000 ms |
| `"Previous 7 days"` | 604 800 000 ms |
| `"All time"` | Infinity |

4. Call `context.reddit.remove(id, markAsSpam)` on every matched post and comment (parallel)

#### `processBan(values, context)` — Single Ban Flow
1. Parse form values into a `BanEvent`
2. Normalize `removeContent` (handle undefined/empty → `'Do not remove'`)
3. Call `banUser()` — show error toast on failure
4. If `removeContent !== 'Do not remove'`: call `removeUserContent()` — show error toast on failure
5. Show success toast on full or partial success

#### `processBulkBan(values, context)` — Bulk Ban Flow
1. Parse semicolon-separated usernames (`parseUsernameList()`)
2. Validate list is not empty — show error toast and abort if empty
3. Show processing toast: `"Processing X users..."`
4. For each username (do NOT abort on first failure):
   - Call `banUser()` — track error if it fails
   - If `removeContent !== 'Do not remove'`: call `removeUserContent()` — track error
   - Track success count
5. After all users processed, show summary:
   - `"{successCount} users banned successfully"`
   - If errors: `"{errorCount} errors occurred"` + first 3 error details

### 7.2 UserService

#### `getBannedUsers(context, subredditName)`
Calls `context.reddit.getBannedUsers({ subredditName }).all()` and returns User array.

#### `formatUsersForExport(users)`
Maps User array → semicolon-separated string of usernames.

#### `parseUsernameList(usernames)`
Splits on `;`, trims whitespace, filters empty strings → returns `string[]`.

---

## 8. Reddit API Calls Used

| Method | Used In |
|---|---|
| `reddit.banUser()` | BanService.banUser |
| `reddit.getPostById()` | banUser menu item |
| `reddit.getCommentById()` | banUser menu item |
| `reddit.getUserById()` | banUser menu item |
| `reddit.getCurrentSubreddit()` | all menu items |
| `reddit.getSubredditRemovalReasons()` | banUser, bulkBanUsers menu items |
| `reddit.getPostsByUser().all()` | BanService.removeUserContent |
| `reddit.getCommentsByUser().all()` | BanService.removeUserContent |
| `reddit.remove()` | BanService.removeUserContent |
| `reddit.getBannedUsers().all()` | exportBannedUsers menu item |

---

## 9. User Feedback (Toasts)

| Trigger | Toast message |
|---|---|
| Export starts | `"Fetching banned users..."` |
| Bulk ban starts | `"Processing X users..."` |
| Single ban success | `"User {username} banned. [Content removed from last X / all time]"` |
| Bulk ban success | `"{count} users banned successfully"` |
| Bulk ban with errors | `"{errorCount} errors occurred"` + first 3 error details |
| Ban failure | Error message from exception |
| Content removal failure | Error message from exception |
| No usernames entered | Error toast |

---

## 10. End-to-End Flows

### Single Ban Flow
```
Mod right-clicks post or comment
  → "Ban User and Remove Content"
    → fetch author, subreddit, removal reasons, settings
    → show Ban User Form (pre-filled)
      → mod adjusts fields, submits
        → BanService.processBan()
          → reddit.banUser()
          → [optional] reddit.remove() for each matching post/comment
          → toast: success or error
```

### Bulk Ban Flow
```
Mod opens subreddit menu
  → "Ban Extended: Bulk Ban Users"
    → fetch subreddit, removal reasons, settings
    → show Bulk Ban Form
      → mod pastes semicolon-separated usernames, submits
        → BanService.processBulkBan()
          → for each username: banUser() + [optional] removeUserContent()
          → toast: "N users banned, M errors"
```

### Export Flow
```
Mod opens subreddit menu
  → "Ban Extended: Export Banned Users"
    → toast: "Fetching banned users..."
    → reddit.getBannedUsers().all()
    → format as semicolon-separated string
    → show Export Form (read-only list)
      → mod copies the list → Done
```

---

## 11. Constraints & Edge Cases to Preserve

- `ruleViolated` must be truncated to **100 characters** before passing to `reddit.banUser()`
- Bulk ban **must not halt** on individual user failure — collect errors and report at the end
- Export form has **no submit processing** — the "Done" button just closes the form
- If subreddit has **no removal reasons**, show an error and prevent the bulk ban form from opening
- Content removal filters by **both subreddit AND time period** — a user's global content is not touched
- `banDuration` of `undefined` means a **permanent** ban (not 0 or any integer)
- The `gap` attribute does not accept `xsmall` — do not use it
- Padding values must be: `'xsmall' | 'small' | 'medium' | 'large'` — no pixels
- `useEffect` does not exist in Devvit — do not use it
