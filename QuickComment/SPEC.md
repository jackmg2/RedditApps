# Specification: El Commentator (QuickComment) v0.0.5

## Context

This document captures the full specification of the existing Devvit Reddit app "El Commentator" to serve as the source of truth for a framework rewrite. The app is a subreddit moderation tool that manages and auto-posts predefined comment templates.

---

## What the App Does

El Commentator lets Reddit moderators define comment templates and have them posted automatically (or manually) on posts — matched either by post flair or by the username of the author.

---

## Technology Stack (Current)

| Layer | Technology |
|---|---|
| Framework | Devvit (Reddit App Platform) |
| Language | TypeScript / TSX |
| Storage | Redis (via `context.redis`) |
| UI | Devvit native forms + modals |
| API | `@devvit/public-api` |
| Deployment | Devvit CLI |

---

## Data Model

### `Comment` (Flair-Based Template)
```typescript
{
  id: string;
  title: string;                    // Human-readable name
  comment: string;                  // The actual comment text
  flairs: string[];                 // Flair IDs that trigger this template
  displayOnAllPosts: boolean;       // If true, matches every post regardless of flair
  pinnedByDefault: boolean;         // Whether to sticky the comment when posted
}
```

### `UserComment` (User-Based Template)
```typescript
{
  id: string;
  title: string;
  comment: string;
  username: string;                 // Target Reddit username (case-insensitive, "u/" stripped)
  pinnedByDefault: boolean;
}
```

### `PostFlair`
```typescript
{
  id: string;
  text: string;
}
```

### `CommentSelection` (Internal)
```typescript
{
  commentText: string;
  shouldPin: boolean;
}
```

---

## Storage Layer

Uses Redis via `context.redis`. All values are JSON strings.

| Key | Type | Description |
|---|---|---|
| `predefined_comments` | `Comment[]` | All flair-based templates |
| `user_comments` | `UserComment[]` | All user-based templates |
| `next_comment_id` | `number` | Auto-increment counter for flair templates |
| `next_user_comment_id` | `number` | Auto-increment counter for user templates |

**`CommentStorage` class** (`src/storage/index.ts`) provides:
- `getComments()` / `saveComments(comments)`
- `getUserComments()` / `saveUserComments(userComments)`
- `getNextId()` / `getNextUserId()`
- `findCommentById(id)` / `findUserCommentById(id)`
- `deleteComment(id)` / `deleteUserComment(id)`

---

## App Settings (Subreddit-Level)

| Setting | Type | Default | Description |
|---|---|---|---|
| `autoCommentEnabled` | boolean | false | Enables auto-commenting on new posts |
| `defaultValuePinComment` | boolean | false | Default state of the "pin" checkbox |

---

## Menu Items (All Moderator-Only)

Seven context menu items registered via Devvit's menu system:

| # | Label | Location | Purpose |
|---|---|---|---|
| 1 | Post Predefined Comment | Post | Manually post any template to the current post |
| 2 | Create Comment Template | Subreddit | Create a new flair-based template |
| 3 | Create User Comment Template | Subreddit | Create a new user-based template |
| 4 | Edit Comment Template | Subreddit | Edit an existing flair-based template |
| 5 | Edit User Comment Template | Subreddit | Edit an existing user-based template |
| 6 | Delete Comment Template | Subreddit | Delete any template (flair or user) |
| 7 | View All Templates | Subreddit | Read-only view of all templates |

---

## Forms & UI

All forms use Devvit's `createForm()` API. Each form renders a modal dialog with fields.

### Flair-Based Forms (`src/forms/comment/`)

**PostComment** — Manually post a template
- Dropdown: select a flair template (by title)
- Checkbox: "Pin comment?"
- On submit → `handlePostComment()`

**CreateComment** — Create a new flair template
- Text: Title
- Textarea: Comment text
- Multi-select: Flair tags (fetched from subreddit)
- Checkbox: "Display on all posts"
- Checkbox: "Pin by default"
- On submit → `handleCreateComment()`

**EditComment** — Edit an existing flair template
- Dropdown: Select template to edit
- Text: Title (prefilled)
- Textarea: Comment text (prefilled)
- Multi-select: Flair tags (prefilled)
- Checkbox: "Display on all posts" (prefilled)
- Checkbox: "Pin by default" (prefilled)
- On submit → `handleEditComment()`

**DeleteComment** — Delete a flair template
- Dropdown: Select template to delete
- On submit → `handleDeleteComment()`

### User-Based Forms (`src/forms/user/`)

**CreateUserComment** — Create a user template
- Text: Title
- Text: Username (auto-strips "u/" prefix)
- Textarea: Comment text
- Checkbox: "Pin by default"
- On submit → `handleCreateUserComment()`

**EditUserComment** — Edit a user template
- Dropdown: Select template to edit
- Text: Title (prefilled)
- Text: Username (prefilled)
- Textarea: Comment text (prefilled)
- Checkbox: "Pin by default" (prefilled)
- On submit → `handleEditUserComment()`

**DeleteUserComment** — Delete a user template
- Dropdown: Select template to delete
- On submit → `handleDeleteUserComment()`

### Unified Forms (`src/forms/shared/`)

**DeleteAnyComment** — Delete any template (flair or user)
- Dropdown: Shows all templates with type prefix (`"flair:id"` / `"user:id"`)
- On submit → `handleDeleteAnyComment()` which parses the prefix and routes to the correct delete function

### Other Forms

**ViewAllTemplates** — Read-only formatted display
- Shows all flair templates (with flairs, displayOnAllPosts, pinnedByDefault)
- Shows all user templates (with username, pinnedByDefault)
- No editable fields

---

## Comment Selection Logic (Auto-Post)

File: `src/utils/commentSelector.ts`

When a new post is submitted, the selector finds the best matching comment using a **priority system**:

### Flair Comment Priority (highest → lowest)
1. **Priority 1:** Templates whose `flairs` array contains exactly 1 flair that matches the post's flair
2. **Priority 2:** Templates whose `flairs` array contains multiple flairs, one of which matches
3. **Priority 3:** Templates with `displayOnAllPosts: true`

When multiple templates match the same priority level, one is chosen **randomly**.

### User Comment
- Checked independently: if the post author's username matches any `UserComment.username` (case-insensitive), a matching template is randomly selected.

### Comment Merging
- If **both** a flair comment and a user comment match, their text is **merged** with separator: `\n\n---\n\n`
- The `shouldPin` value comes from the flair comment (or user comment if no flair comment exists)

---

## Auto-Comment Trigger

File: `src/triggers/autoComment.ts`

- **Event:** `PostSubmit` (fires on every new post in the subreddit)
- **Guard:** Checks `autoCommentEnabled` app setting — exits early if false
- **Logic:**
  1. Calls `CommentSelector.selectComment(context, postId)`
  2. If a match is found, calls `postComment(context, postId, commentText, shouldPin)`
  3. Errors are caught and logged via `console.error`

---

## Reddit API Utilities

File: `src/utils/reddit.ts`

**`getSubredditFlairs(context)`**
- Calls `context.reddit.getFlairTemplates(subredditName)`
- Returns `PostFlair[]` for use in form dropdowns

**`postComment(context, postId, text, pin)`**
- Calls `context.reddit.submitComment({ id: postId, text })`
- If `pin === true`, calls `comment.distinguish(true)` to sticky it

---

## Formatting Utilities

File: `src/utils/formatters.ts`

- `formatCommentOption(comment)` → `"Title (flair1, flair2)"` or `"Title (All Posts)"`
- `formatUserCommentOption(userComment)` → `"Title (u/username)"`
- `formatUnifiedCommentOption(comment | userComment, type)` → `"[Flair] Title"` / `"[User] Title (u/username)"`
- `formatAllComments(comments, userComments)` → Multi-section readable string for ViewAllTemplates form

---

## Validation Utilities

File: `src/utils/validators.ts`

- `cleanUsername(raw)` → strips `"u/"` prefix, trims whitespace
- `isUsernameAvailable(username, userComments)` → checks if a username slot is already taken
- `validateCommentData(title, comment)` → ensures neither field is empty

---

## Data Flow

### Manual Comment Post
```
Mod clicks "Post Predefined Comment" on a post
  → PostComment form shown (template dropdown, pin checkbox)
  → handlePostComment() called
  → postComment() calls Reddit API
  → Toast confirmation shown to mod
```

### Template CRUD
```
Mod clicks menu item (Create / Edit / Delete)
  → Form shown (prefilled for edit)
  → Handler called on submit
  → CommentStorage reads/writes Redis
  → Toast confirmation shown
```

### Auto-Comment on New Post
```
User submits post to subreddit
  → PostSubmit trigger fires
  → autoCommentEnabled checked (exit if false)
  → CommentSelector.selectComment() runs priority logic
  → If match: postComment() calls Reddit API (+ distinguish if pin)
  → Error logged if anything fails
```

---

## Key Behavioral Rules

1. All menu items are **moderator-only** (`forUserType: 'moderator'`).
2. Usernames are normalized: `"u/"` prefix stripped, lowercased for comparison.
3. One username can have **multiple** user templates — one is picked randomly on match.
4. When both a flair and a user template match, their text is **merged** with `---` separator.
5. Auto-commenting is **opt-in** via subreddit app setting.
6. All IDs are numeric strings with separate auto-increment counters per type.
7. The app requests only `redditAPI: true`; HTTP is disabled.
