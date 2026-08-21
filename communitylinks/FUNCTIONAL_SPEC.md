# Functional Specification: Community Links

## 1. Overview

**Community Links** is an embeddable link-board application for Reddit communities (subreddits). It replaces static sidebar links with a rich, interactive grid of tiles that moderators can curate, style, and analyze. Each tile supports multiple content variants that rotate between viewers, enabling built-in A/B testing with impression and click-through tracking.

The current implementation is a Reddit Devvit app (TypeScript/React-like components) backed by Redis. This document describes the product behavior and data model in technology-neutral terms so it can be re-implemented on any stack.

---

## 2. Actors

| Actor | Description |
|---|---|
| **Viewer** | Any Reddit user viewing the post. Read-only access. Can click links. |
| **Editor** | A moderator of the subreddit, or a username explicitly added to the edit whitelist in subreddit settings. Full CRUD access. |

---

## 3. Core Concepts

### 3.1 Board
A single Reddit post that hosts the entire app. There is exactly one Board per post. A Board contains one or more **Pages**.

### 3.2 Page
A named, themed screen within a Board. Each Page owns a flat array of **Cells** arranged in a configurable grid. Pages have visual styling (background color, foreground color, background image) and a column count that determines the grid layout.

### 3.3 Cell
A position in the grid. A Cell can be **empty** or **active**. An active Cell holds one or more **Link Variants** (used for A/B testing). The Cell tracks aggregate impression data across all its variants.

A Cell is considered **empty** if it has no variants, or if all its variants have no URL, title, or image set.

### 3.4 Link (Variant)
The actual content shown in a Cell: a URL, a display title, an optional image, optional description, and visual styling (text color, title background color, background opacity). Each Link records its own click count.

When a Cell has only one non-empty Link, that Link is always shown. When a Cell has two or more non-empty Links, the system selects which one to show based on weighted rotation (A/B testing mode). Rotation is automatically enabled when a second variant is added and disabled when it drops back to one.

---

## 4. Feature List

### 4.1 Board Creation
- An Editor creates a Board from the subreddit mod tools menu ("Create Links Board").
- A title prompt is shown; the title becomes the first Page's title.
- On creation the Board is initialized with one Page containing a 4×4 grid (16 empty Cells).

### 4.2 Page Navigation (Viewer & Editor)
- Users navigate between pages with Previous / Next buttons in the header.
- The current page title is shown in the center of the header.
- Page count and current index are displayed.

### 4.3 Grid Display
- The grid respects the Page's `columns` setting (default 4).
- Row count = `ceil(cell_count / columns)`.
- Empty Cells render as blank placeholders.
- Active Cells render:
  - Full-bleed background image (if set).
  - Title text with a semi-transparent colored background bar.
  - An **Info button** in the corner if the Link has a non-empty description.
- Clicking an active Cell in view mode navigates to the Link's URL and increments the click count for that Link and the impression count for that Cell.

### 4.4 Edit Mode
Editors toggle edit mode with the Edit button (pencil icon). In edit mode:

#### Toolbar actions
| Action | Behavior |
|---|---|
| Edit Page | Opens the Page style form |
| Add Row | Appends one row of empty Cells to the current Page |
| Remove Row | Deletes the last row of the current Page |
| Add Column | Adds one column to the current Page |
| Remove Column | Removes the last column from the current Page |
| Add Page Before | Inserts a new empty Page before the current one |
| Add Page After | Inserts a new empty Page after the current one |
| Remove Page | Deletes the current Page (only available when more than one Page exists) |
| Background Image | Opens the image upload form |
| Analytics | Opens the analytics overlay |
| Save / Exit | Exits edit mode, persists all changes |

#### Cell actions in edit mode
- **Empty Cell** — click opens the Edit Cell form to add a new Link.
- **Active Cell** — shows the current variant index badge (e.g. "1/3") and a click-count badge.
  - Click opens the Edit Cell form for the currently displayed variant.
  - **Rotate button** (refresh icon): cycles to the next variant in edit preview.
  - **Add button** (+): adds a new empty variant and opens the Edit Cell form for it.
  - **Delete button** (trash): removes the current variant. If it is the last variant, the Cell is cleared.
- Row remove buttons appear on the left of each row.
- Column remove buttons appear above each column.

### 4.5 Edit Cell Form
Fields:

| Field | Type | Notes |
|---|---|---|
| Title | Text | Display label for the Link |
| URL | Text | Destination URL; validated and normalized on save |
| Image URL | Text | Optional background image for the Cell |
| Text Color | Hex color | Color of the title text |
| Background Color | Hex color | Color of the title bar background |
| Background Opacity | Number 0–1 | Opacity of the title bar |
| Description | Text | Optional detail text shown in the Info popup |
| Variant Weight | Number ≥ 1 | Relative probability for A/B rotation |

### 4.6 Edit Page Form
Fields: Title, Background Color (hex), Foreground Color (hex).

### 4.7 Background Image Upload
Editors can upload or set a URL for the Page background image. Displayed behind all Cells.

### 4.8 Delete Board
A Delete Post button (visible to moderators only) triggers a confirmation form. On confirmation, the Board post and all associated stored data are deleted.

### 4.9 A/B Testing (Variant Rotation)
When a Cell has 2+ active variants:
- Each render call picks one variant using **weighted, deterministic selection**.
- Selection is seeded per user session (same user sees same variant per session, preventing flicker).
- Each render increments the Cell's impression count and the variant-specific impression count.
- On click, the Link's click count increments.
- Rotation can be toggled off per Cell (Editor setting), freezing display on the first variant.

**Weighted selection algorithm:**
- Each variant has a numeric weight (default 1).
- A seeded pseudo-random number determines which variant's cumulative weight range is selected.
- If all weights are equal, all variants appear with equal probability.

### 4.10 Analytics Dashboard
Accessible via the toolbar (bar-chart icon). Shows three tabs:

#### Overview tab
- Total clicks across all Pages.
- Total impressions across all Pages.
- Overall click-through rate (CTR = clicks / impressions × 100).
- Most-clicked Page.
- Most-clicked Cell.
- Count of active A/B tests.
- Suggested actions (auto-generated from performance thresholds).

#### A/B Tests tab
- List of all Cells with rotation enabled and at least 2 variants.
- Per variant: impressions, clicks, CTR, weight ratio vs actual share.
- Statistical significance indicator (flags when one variant clearly leads).
- Best performer highlighted.

#### Pages tab
- Per-Page: total clicks, total impressions, CTR, active cell count.
- Heatmap data: clicks per row, clicks per column.
- Top 3 performing Cells per Page.

### 4.11 Edit Whitelist
Subreddit-level setting: a semicolon-separated list of Reddit usernames who are granted Editor access without being moderators. Matching is case-insensitive.

---

## 5. Data Model

### 5.1 Entity Relationship

```
Board (1)
  └── Page (1..N)
        └── Cell (1..N, ordered flat array)
              └── Link/Variant (1..N)
```

### 5.2 Board

| Field | Type | Description |
|---|---|---|
| `id` | string (UUID) | Unique identifier |
| `postId` | string | The Reddit post ID this board is attached to |
| `pageIds` | string[] | Ordered list of Page IDs |

Derived (not stored):
- `totalClicks` — sum of all Link click counts
- `totalImpressions` — sum of all Cell impression counts

### 5.3 Page

| Field | Type | Default | Description |
|---|---|---|---|
| `id` | string (UUID) | — | Unique identifier |
| `title` | string | `''` | Display name shown in navigation header |
| `backgroundColor` | hex string | `'#000000'` | Page background color |
| `foregroundColor` | hex string | `'#FFFFFF'` | Primary text color |
| `backgroundImage` | string (URL) | `''` | Full-bleed background image URL |
| `columns` | integer | `4` | Number of columns in the grid |
| `cellIds` | string[] | 16 new cell IDs | Ordered flat array of Cell IDs |

Grid rows = `ceil(cellIds.length / columns)`.

### 5.4 Cell (LinkCell)

| Field | Type | Default | Description |
|---|---|---|---|
| `id` | string (UUID) | — | Unique identifier |
| `displayName` | string | `''` | Editor label (not shown to viewers) |
| `rotationEnabled` | boolean | `false` | Whether A/B rotation is active |
| `impressionCount` | integer | `0` | Total renders of this Cell across all variants |
| `variantImpressions` | `{ [linkId: string]: number }` | `{}` | Per-variant impression counts |
| `currentEditingIndex` | integer | `0` | Index of variant being previewed in edit mode |
| `links` | Link[] | `[new Link()]` | Ordered array of Link variants |
| `weights` | number[] | `[1]` | Weight for each Link (parallel array, same length) |

Invariants:
- `links.length === weights.length` always.
- At least one element in `links` always (may be an empty Link).
- `rotationEnabled` is auto-set `true` when 2+ non-empty links exist; auto-set `false` when only 1 remains.

### 5.5 Link (Variant)

| Field | Type | Default | Description |
|---|---|---|---|
| `id` | string (UUID) | — | Unique identifier |
| `uri` | string | `''` | Destination URL |
| `title` | string | `''` | Display title text |
| `image` | string (URL) | `''` | Background image URL |
| `textColor` | hex string | `'#FFFFFF'` | Title text color |
| `description` | string | `''` | Long-form description (shown in info popup) |
| `backgroundColor` | hex string | `'#000000'` | Title bar background color |
| `backgroundOpacity` | float 0–1 | `0.5` | Title bar background opacity |
| `clickCount` | integer | `0` | Number of times this variant was clicked |

A Link is **empty** if `uri`, `title`, and `image` are all blank/null.

---

## 6. Storage Schema (Redis Hash Mapping)

The current implementation uses Redis hash keys. The mapping below is canonical for rebuilding on any KV or document store.

### Key: `linker_{postId}`
| Hash Field | Type | Description |
|---|---|---|
| `id` | string | Board ID |
| `pageIds` | comma-separated string | Ordered Page IDs |

### Key: `page_{postId}_{pageId}`
| Hash Field | Type | Description |
|---|---|---|
| `id` | string | Page ID |
| `title` | string | Page title |
| `backgroundColor` | string | Hex color |
| `foregroundColor` | string | Hex color |
| `backgroundImage` | string | URL or empty |
| `columns` | string (number) | Column count |
| `cellIds` | comma-separated string | Ordered Cell IDs |

### Key: `cell_{postId}_{cellId}`
| Hash Field | Type | Description |
|---|---|---|
| `id` | string | Cell ID |
| `displayName` | string | Editor label |
| `rotationEnabled` | `'true'` or `'false'` | A/B rotation toggle |
| `impressionCount` | string (integer) | Total impressions |
| `currentEditingIndex` | string (integer) | Edit preview index |
| `links` | JSON string | Serialized `Link[]` array |
| `weights` | JSON string | Serialized `number[]` array |
| `variantImpressions` | JSON string | Serialized `{ [linkId]: number }` map |

---

## 7. Permissions Model

| Action | Viewer | Editor |
|---|---|---|
| View board and navigate pages | ✅ | ✅ |
| Click links (tracked) | ✅ | ✅ |
| View link descriptions | ✅ | ✅ |
| Toggle edit mode | ❌ | ✅ |
| Add / edit / delete cells | ❌ | ✅ |
| Add / remove / edit pages | ❌ | ✅ |
| View analytics dashboard | ❌ | ✅ |
| Delete the entire board post | ❌ | Moderators only |

An **Editor** is: any subreddit moderator, OR any username listed (semicolon-separated, case-insensitive) in the subreddit-level `editWhitelist` app setting.

---

## 8. User Flows

### 8.1 Create a Board
1. Moderator opens the subreddit mod tools menu.
2. Selects **"Create Links Board"**.
3. Enters a board title.
4. System creates the Board + first Page + 16 empty Cells.
5. Reddit post is submitted and displayed.

### 8.2 Add a Link (Editor)
1. Enter edit mode (pencil button).
2. Click an empty Cell.
3. Edit Cell form opens. Fill in title, URL, optional image/description/colors.
4. Save. Cell becomes active and is persisted.

### 8.3 Edit a Link (Editor)
1. Enter edit mode.
2. Click an active Cell.
3. Edit Cell form opens pre-populated with current variant data.
4. Modify fields and save.

### 8.4 Add an A/B Variant (Editor)
1. Enter edit mode.
2. Click the **+** button on an active Cell.
3. A new empty variant is added; Edit Cell form opens for it.
4. Fill in variant details and save.
5. Rotation is auto-enabled. Both variants now compete.

### 8.5 Navigate Variants in Edit Mode (Editor)
1. Enter edit mode.
2. Click the **Rotate** (refresh) button on an active Cell to cycle preview through variants.
3. The variant index badge (e.g. "2/3") updates accordingly.

### 8.6 Delete a Variant (Editor)
1. Enter edit mode, navigate to target variant using Rotate button.
2. Click the **Delete** button on the Cell.
3. If more than one variant exists: variant is removed, rotation stays enabled if 2+ remain.
4. If this is the last variant: Cell is cleared (becomes empty).

### 8.7 Manage Pages (Editor)
1. In edit mode, use toolbar buttons to add a page before or after the current one.
2. Navigate between pages using the header arrows.
3. Use the Remove Page button (only shown when multiple pages exist) to delete the current page.

### 8.8 View Analytics (Editor)
1. Click the analytics (bar chart) button in the toolbar.
2. Modal opens with Overview, A/B Tests, and Pages tabs.
3. All metrics are calculated client-side from stored counts.

### 8.9 Delete the Board (Moderator)
1. Click the Delete Post button (visible to moderators only).
2. Confirmation form displayed.
3. On confirm: all Redis keys for the board are deleted and the Reddit post is removed.

---

## 9. Analytics Calculations

All metrics are calculated from stored raw counts (no separate aggregation store).

| Metric | Formula |
|---|---|
| CTR (click-through rate) | `clickCount / impressionCount × 100` |
| Variant probability | `variantWeight / sum(allWeights)` |
| Actual variant share | `variantImpressions / totalCellImpressions` |
| Statistical significance | Flag when one variant's CTR exceeds others by a meaningful margin AND has sufficient impressions (implementation-defined threshold) |
| Low performers | < 50% of active cells on a page have any clicks |
| Engagement rate | Percentage of cells that have been clicked at least once |

---

## 10. Business Rules & Constraints

1. **Minimum one variant per Cell** — Cells always retain at least one Link object (may be empty).
2. **Weights must be positive** — Default weight is 1; weights drive rotation probability.
3. **Rotation auto-management** — `rotationEnabled` is managed automatically based on active variant count; editors can also toggle it manually.
4. **Session-stable variant display** — Within one user session, the same variant is shown for a given Cell (deterministic seeded selection), preventing flicker.
5. **Impression tracking** — An impression is recorded each time a Cell renders to a viewer (not in edit mode).
6. **Click tracking** — A click is recorded on the specific Link variant that was displayed when the user clicked.
7. **Empty Cell filtering** — Empty Cells (no URI, title, or image on any variant) are displayed as blank and are not clickable.
8. **Grid integrity** — Adding/removing rows or columns adjusts the Cell array accordingly; removing a row deletes the last row's Cells and their data.
9. **Page deletion cleanup** — Deleting a page deletes all its Cells and their stored data.
10. **Board deletion cleanup** — Deleting the board deletes all pages, cells, and their stored data recursively.
11. **Whitelist format** — Usernames separated by semicolons; matching is case-insensitive; spaces around semicolons are trimmed.

---

## 11. Default Values Reference

| Property | Default |
|---|---|
| Grid columns | 4 |
| Initial cells per page | 16 (4×4) |
| Page background color | `#000000` |
| Page foreground color | `#FFFFFF` |
| Link text color | `#FFFFFF` |
| Link title background color | `#000000` |
| Link title background opacity | `0.5` |
| Variant weight | `1` |
| Rotation enabled | `false` (auto `true` at 2+ variants) |
| Impression count (new cell) | `0` |
| Click count (new link) | `0` |
