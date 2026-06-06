# FlairAndApprove — Functional Specification

**Version:** 1.0  
**Date:** 2026-05-25  
**Purpose:** Migration reference — describes the behavior of the current Devvit implementation so it can be faithfully reproduced on the new Reddit tech stack.

---

## 1. Overview

**FlairAndApprove** is a Reddit moderator tool that combines user verification, flair assignment, content approval, and welcome messaging into a single unified workflow. Moderators can approve and flair a user in one form submission instead of navigating across multiple Reddit mod tools.

**Tech Stack (current):**
- Framework: Devvit (Reddit's app platform)
- Language: TypeScript
- Data persistence: Redis (sorted sets + strings)
- UI: Devvit form system (modal dialogs)
- External HTTP: none — all interactions via Reddit API or Redis

**Access control:** All entry points are restricted to `forUserType: 'moderator'`.

---

## 2. Entry Points

The app registers four menu items. All are moderator-only.

| Menu Item Label | Location | Handler |
|---|---|---|
| "Approve & Flair: Verify and Approve" | Post context menu | `verifyAndApprovePostMenuItem` |
| "Approve & Flair: Verify and Approve" | Comment context menu | `verifyAndApproveCommentMenuItem` |
| "Approve & Flair: Bulk Approve & Flair Users" | Subreddit menu | `bulkApproveMenuItem` |
| "Approve & Flair: Export Approved Users" | Subreddit menu | `exportApprovedUsersMenuItem` |

---

## 3. Configuration Settings

Settings are configured per-subreddit in the Devvit mod settings panel (not in the app UI itself). They are read at runtime via `context.settings.getAll()`.

| Setting Key | Type | Default | Description |
|---|---|---|---|
| `defaultComment` | string (paragraph) | `"Welcome to the community!"` | Text posted as the welcome comment. If empty, no comment is posted. |
| `defaultValueApproveUser` | boolean | `true` | Whether "Approve user" is pre-checked in forms. |
| `defaultValueApprovePost` | boolean | `true` | Whether "Approve post" is pre-checked in the post approval form. |
| `defaultValueApproveComment` | boolean | `true` | Whether "Approve comment" is pre-checked in the comment approval form. |
| `autoAddModNote` | boolean | `true` | Whether a mod note is automatically created on each approval. |

---

## 4. Workflow 1 — Single Post Approval

### Trigger
Moderator opens the context menu on a **post** and selects "Approve & Flair: Verify and Approve".

### Pre-form logic
Before showing the form, the menu handler:
1. Calls `context.reddit.getPostById(postId)` to retrieve the post.
2. Calls `context.reddit.getUserById(authorId)` to get the author's username.
3. Calls `flairService.getFlairTemplates(subredditName)` → `context.reddit.getUserFlairTemplates()`.
4. Reads all settings via `context.settings.getAll()`.
5. If no flair templates exist, shows a toast error and aborts: _"No flair templates available in this subreddit"_.

### Form fields

| Field | Type | Editable | Value |
|---|---|---|---|
| SubReddit | text | No | Current subreddit name |
| Username | text | No | Post author's username |
| Post ID | text | No | Reddit post ID |
| Flair | dropdown | Yes | List of flair templates; first item pre-selected |
| Comment | textarea | Yes | Pre-filled with `defaultComment` setting |
| Approve user | checkbox | Yes | Pre-checked per `defaultValueApproveUser` setting |
| Approve post | checkbox | Yes | Pre-checked per `defaultValueApprovePost` setting |

### On submit
`approvalService.processApproval()` executes all selected actions via `Promise.allSettled()` (parallel):

1. **Always:** `flairService.setUserFlair()` → `context.reddit.setUserFlair(subreddit, username, flairTemplateId)`
2. **If "Approve user" checked:**
   - `userService.approveUser()` → `context.reddit.approveUser(username, subreddit)`
   - `storageService.storeApprovalTimestamp()` → `redis.zAdd('approval_timestamps_{subreddit}', { score: Date.now(), member: username })`
   - If `autoAddModNote` enabled: `modNoteService.addApprovalNote()` → `context.reddit.addModNote()` (non-blocking — failure doesn't abort)
3. **If "Approve post" checked:** `context.reddit.approve(postId)`
4. **If comment field is non-empty:** `context.reddit.submitComment()` then `comment.distinguish(true)` to pin as mod comment

### Toast feedback
A toast is shown for each action result:
- "Flair applied successfully."
- "[username] approved."
- "Post approved."
- "Comment posted and pinned."
- On failure: "Error: [message] failed."

---

## 5. Workflow 2 — Single Comment Approval

Identical to Workflow 1 except:
- Triggered from a **comment** context menu.
- Uses `context.reddit.getCommentById(commentId)` instead of `getPostById`.
- Form has **Comment ID** field instead of Post ID.
- Checkbox label is "Approve comment" (controlled by `defaultValueApproveComment`).
- On submit, `context.reddit.approve(commentId)` approves the comment instead of the post.

---

## 6. Workflow 3 — Bulk User Approval

### Trigger
Moderator clicks "Approve & Flair: Bulk Approve & Flair Users" from the subreddit menu.

### Pre-form logic
1. Loads flair templates for the current subreddit.
2. If no flair templates exist, shows toast error and aborts.

### Form fields

| Field | Type | Editable | Value |
|---|---|---|---|
| SubReddit | text | No | Current subreddit name |
| Usernames | textarea | Yes | Empty; user pastes semicolon-separated list (e.g., `user1;user2;user3`) |
| Flair to Apply | dropdown | Yes | List of flair templates |
| Approve all users | checkbox | Yes | Pre-checked per `defaultValueApproveUser` setting |

### On submit
`approvalService.processBulkApproval()`:
1. Parses the usernames field: splits on `;`, trims whitespace, filters empty strings.
2. If no valid usernames: shows toast "No valid usernames provided" and aborts.
3. For each username (sequential, not parallel):
   - `flairService.setUserFlair(subreddit, username, flairTemplateId)`
   - If "Approve all users" checked:
     - `userService.approveUser(username, subreddit)`
     - `storageService.storeApprovalTimestamp(username, subreddit)`
     - If `autoAddModNote` enabled: `modNoteService.addApprovalNote(username, subreddit, isBulk: true)`
   - On error: error message captured, processing continues with next user.

### Toast feedback
- Success: "✅ Successfully processed [N] users"
- Partial failure: "❌ Failed to process [N] users" + "Errors: [first 3 errors]..." (truncated with `...` if more than 3)

---

## 7. Workflow 4 — Export Approved Users

This workflow is two forms in sequence.

### Trigger
Moderator clicks "Approve & Flair: Export Approved Users" from the subreddit menu.

### Step 1 — Time Range Selection Form

**Pre-form logic:** Loads `last_export_date_{subreddit}` from Redis.

**Form fields:**

| Field | Type | Editable | Value |
|---|---|---|---|
| SubReddit | text | No | Current subreddit name |
| Last Export | text | No | Formatted last export date, or blank if never exported |
| Time Range | dropdown | Yes | Options: "All Time", "Past Month", "Past 7 Days" |

### Step 2 — Export Results Form

**On submit of Step 1:**
1. `userService.getApprovedUsers()` → `context.reddit.getApprovedUsers(subreddit)` — fetches full approved users list from Reddit.
2. If "All Time": uses the full list.
3. If "Past Month" or "Past 7 Days":
   - `storageService.getFilteredUsernames()` → `redis.zRange('approval_timestamps_{subreddit}', startScore, endScore, { by: 'score' })`
   - Filters the Reddit approved users list to only include usernames present in the Redis result.
4. `userService.formatUsersForExport()` → converts to semicolon-separated string.
5. If result is empty: shows toast "No approved users found for the selected time range" and aborts.
6. `storageService.storeLastExportDate()` → `redis.set('last_export_date_{subreddit}', isoTimestamp)`
7. Opens the results form.

**Results form fields:**

| Field | Type | Editable | Value |
|---|---|---|---|
| SubReddit | text | No | Current subreddit name |
| Time Range | text | No | Human-readable selected range |
| Last Export | text | No | Only shown if a previous export timestamp exists |
| Approved Users | textarea | No | Semicolon-separated usernames (compatible with bulk import input) |

Form title includes total user count: e.g., "Approved Users (42)".

---

## 8. Mod Note Format

When `autoAddModNote` is enabled, a mod note is added for each approved user:

```
User approved via Approve & Flair tool

Type: [Manual | Bulk]

Moderator: [current mod username]

Date: [ISO timestamp]
```

- Label: `HELPFUL_USER`
- Fetches moderator username via `context.reddit.getCurrentUser()`
- Failures are logged but do not block the approval

---

## 9. Data Storage (Redis)

### Approval Timestamps (Sorted Set)

**Key:** `approval_timestamps_{subredditName}`  
**Structure:** Redis sorted set  
**Member:** username (string)  
**Score:** Unix timestamp in milliseconds  
**Written by:** Workflows 1, 2, 3 when "Approve user" is checked  
**Read by:** Workflow 4 for time-range filtering

### Last Export Date (String)

**Key:** `last_export_date_{subredditName}`  
**Value:** ISO timestamp string  
**Written by:** Workflow 4 on each export  
**Read by:** Workflow 4 time range selection form (displayed as "Last Export")

---

## 10. Reddit API Calls

| Operation | Method | When Called |
|---|---|---|
| Fetch post details | `getPostById(postId)` | Post menu item triggered |
| Fetch comment details | `getCommentById(commentId)` | Comment menu item triggered |
| Fetch author username | `getUserById(authorId)` | Post/comment menu item triggered |
| Fetch flair templates | `getUserFlairTemplates(subreddit)` | All menu items on open |
| Set user flair | `setUserFlair(subreddit, username, templateId)` | All approval form submissions |
| Approve user | `approveUser(username, subreddit)` | When "Approve user" checkbox is checked |
| Approve content | `approve(postId / commentId)` | When "Approve post/comment" checkbox is checked |
| Post welcome comment | `submitComment({ postId, text })` | When comment field is non-empty |
| Distinguish comment | `comment.distinguish(true)` | After `submitComment` succeeds |
| Add mod note | `addModNote(username, subreddit, note, label)` | When `autoAddModNote` is enabled |
| Get current mod | `getCurrentUser()` | When creating mod note |
| Get approved users | `getApprovedUsers(subreddit)` | Export workflow Step 1 submit |

---

## 11. Error Handling

| Scenario | Behavior |
|---|---|
| No flair templates | Toast error; form never shown |
| No valid usernames (bulk) | Toast error; processing aborted |
| Invalid/deleted username (bulk) | Error captured, user skipped, processing continues |
| Action failure (single approval) | Toast per failed action; other actions still execute (Promise.allSettled) |
| Comment post fails (locked thread) | Toast error for comment; flair and approval still succeed |
| Mod note fails | Error logged to console; approval not blocked |
| Redis write fails | Error logged; approval not blocked |
| No approved users for time range | Toast "No approved users found..."; export form not shown |

---

## 12. File Structure

```
FlairAndApprove/
├── src/
│   ├── main.tsx                          # App entry, Devvit.configure(), menu registration
│   ├── config/
│   │   └── settings.ts                   # Settings schema definitions
│   ├── types/
│   │   └── AppSettings.ts                # TypeScript interfaces (AppSettings, ApprovalFormData)
│   ├── menuItems/
│   │   ├── verifyAndApprove.ts           # Post + comment menu items; getApprovalFormData()
│   │   ├── bulkApprove.ts                # Bulk approval menu item
│   │   └── exportApprovedUsers.ts        # Export menu item + time range + export form handlers
│   ├── forms/
│   │   ├── approvePostForm.ts            # Post approval form definition
│   │   ├── approveCommentForm.ts         # Comment approval form definition
│   │   ├── bulkApproveForm.ts            # Bulk approval form definition
│   │   ├── timeRangeSelectionForm.ts     # Export step 1: time range selection
│   │   └── exportUsersForm.ts            # Export step 2: results display
│   └── services/
│       ├── approvalService.ts            # Orchestrates single + bulk approval flows
│       ├── flairService.ts               # getFlairTemplates, setUserFlair
│       ├── userService.ts                # approveUser, getApprovedUsers, format/parse helpers
│       ├── modNoteService.ts             # addApprovalNote (non-blocking)
│       └── storageService.ts             # Redis read/write for timestamps and export dates
├── FunctionalSpec.md                     # This document
├── README.md
└── TestPlan.md
```
