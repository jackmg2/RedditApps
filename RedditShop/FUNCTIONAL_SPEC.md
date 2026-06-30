# TagIt — Specification

## What Is This?

TagIt brings to Reddit the possibility to tag users or products on a picture on Reddit.
It lets an authorized user take one or more product photos, drop clickable "pins" on specific spots in each photo, and attach a product name and purchase URL to every pin. 
Other users can then browse those images, click the pins to reveal product info, and follow links to buy.
Authorized users can also tag Reddit users who appear in a photo by placing person markers at the exact spot where each user appears; viewers can then tap a marker to see the username and visit their Reddit profile.
This feature is similar to the tag function on Instagram.

The deployment target is a Reddit custom post (via the Devvit framework).

---

## Roles & Permissions

| Role | Can create posts | Can edit posts |
|---|---|---|
| Moderator | Yes (always) | Yes, on any post |
| Post author | Configurable (on/off) | Yes, on their own posts |
| Regular user | No | No |

A single boolean app setting (`allowAllUsers`) controls whether non-moderator authors can create posts.

---

## Data Model

### Post
| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique identifier (matches the platform post ID) |
| `title` | string | Display title of the post |
| `images` | Image[] | Ordered list; at least one required |
| `authorId` | string | User ID of creator |
| `createdAt` | ISO 8601 string | Creation timestamp |
| `clickTracking` | map\<pinId → number\> | Running click count per pin |

### Image
| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique identifier |
| `url` | string | Publicly accessible image URL |
| `pins` | Pin[] | Ordered list; may be empty |
| `userTags` | UserTag[] | Ordered list; may be empty; defaults to `[]` for legacy images |
| `createdAt` | ISO 8601 string | |
| `width` | number (optional) | Pixel width; defaults to 800 |
| `height` | number (optional) | Pixel height; defaults to 600 |
| `aspectRatio` | number (optional) | width / height; used for layout |

### Pin
| Field | Type | Constraints |
|---|---|---|
| `id` | string | Unique identifier |
| `title` | string | Product name; required, non-empty |
| `link` | string | Purchase URL; must start with `https://` |
| `x` | number | Horizontal position as % of image width (0–100, decimals allowed) |
| `y` | number | Vertical position as % of image height (0–100, decimals allowed) |
| `color` | string | Hex color: `#RGB`, `#RRGGBB`, or `#RRGGBBAA` |
| `createdAt` | ISO 8601 string | |

### UserTag
| Field | Type | Constraints |
|---|---|---|
| `id` | string | Unique identifier |
| `username` | string | Reddit username without `u/` prefix; matches `^[A-Za-z0-9_-]{3,20}$` |
| `x` | number | Horizontal position as % of image width (0–100, decimals allowed) |
| `y` | number | Vertical position as % of image height (0–100, decimals allowed) |
| `createdAt` | ISO 8601 string | |

---

## Screens & States

### 1. View Mode (public-facing)

**Layout**
- Display the current image filling the available space.
- Render each pin as a small colored circle at its (`x%`, `y%`) position.
- Render each user tag as a distinct person-marker (different shape/style from product pins) at its (`x%`, `y%`) position.
- Show navigation arrows (prev / next) if the post has more than one image.
- Show an image counter (e.g., "2 / 5") when multiple images exist.
- Show a "Show All Products" button.
- Show a "Show All Tagged Users" button only when the current image has at least one user tag.

**Interactions**
- **Click a pin** → toggle a tooltip for that pin (hide the pin dot while tooltip is shown).
- **Click "Show All Products"** → show all pin tooltips simultaneously (same Instagram-style overlay).
- **Click a user tag marker** → toggle a tooltip for that tag (hide the marker while tooltip is shown).
- **Click "Show All Tagged Users"** → show all user tag tooltips simultaneously.
- **Click prev / next arrow** → navigate to adjacent image; any open tooltips (product or user) close.
- **Click a product link in a tooltip** → open the URL in a new tab and increment `clickTracking[pinId]`.
- **Click a username link in a user tag tooltip** → open `https://www.reddit.com/u/{username}` in a new tab.

**Product pin tooltip content**
- Product title (full text).
- URL, truncated to ~20 characters with ellipsis.
- A tappable/clickable link.

**User tag tooltip content**
- `u/username` label.
- A tappable/clickable link to `https://www.reddit.com/u/{username}`.

### 2. Edit Mode (authorized users only)

Entered via an "Edit" button; exited via "Done".

**Additions over View Mode**
- An invisible 6 × 6 grid overlay covers the image. Each cell is a clickable region.
- Two mode buttons determine what a grid-cell click does: **"Add Product"** (default) and **"Tag User"**.
  - In **Add Product** mode: clicking a cell opens the **Add Pin Form** with the cell's center coordinates pre-filled.
  - In **Tag User** mode: clicking a cell opens the **Add User Tag Form** with the cell's center coordinates pre-filled.
- A **Stats Panel** button opens the analytics summary.
- An **Add Image** button appears.
- A **Remove Image** button appears (disabled / hidden when only one image remains).
- When a pin's tooltip is open, **Edit** and **Remove** action buttons appear inside or beside the tooltip.
- When a user tag's tooltip is open, **Edit** and **Remove** action buttons appear inside or beside the tooltip.

**Mutative actions in edit mode**
| Action | Triggered by | Result |
|---|---|---|
| Add pin | Click grid cell (Add Product mode) → fill Add Pin Form → submit | New Pin appended to current image |
| Edit pin | Click pin → click Edit → fill Edit Pin Form → submit | Pin updated in place |
| Remove pin | Click pin → click Remove | Pin deleted from current image |
| Add user tag | Click grid cell (Tag User mode) → fill Add User Tag Form → submit | New UserTag appended to current image |
| Edit user tag | Click user tag marker → click Edit → fill Edit User Tag Form → submit | UserTag updated in place |
| Remove user tag | Click user tag marker → click Remove | UserTag deleted from current image |
| Add image | Click "Add Image" → fill Add Image Form → submit | New Image appended to post |
| Remove image | Click "Remove Image" | Current image deleted; navigate to adjacent image |

All mutations are persisted immediately (no unsaved-draft state).

### 3. Forms

#### Add / Edit Pin Form
| Field | Input type | Validation |
|---|---|---|
| Product title | Text | Required |
| Purchase link | URL text | Required; must begin with `https://` |
| Color | Selector: 8 preset swatches + "Custom" option showing hex input | Must be valid hex |
| X position | Decimal number | 0–100; pre-filled from grid click |
| Y position | Decimal number | 0–100; pre-filled from grid click |

Edit variant: all fields pre-populated with current pin values.

#### Add / Edit User Tag Form
| Field | Input type | Validation |
|---|---|---|
| Reddit username | Text (without `u/` prefix) | Required; matches `^[A-Za-z0-9_-]{3,20}$` |
| X position | Decimal number | 0–100; pre-filled from grid click |
| Y position | Decimal number | 0–100; pre-filled from grid click |

Edit variant: all fields pre-populated with current tag values.

#### Add Image Form
| Field | Input type | Validation |
|---|---|---|
| Image URL | Text | Required |
| Width (optional) | Integer | Defaults to 800 |
| Height (optional) | Integer | Defaults to 600 |

---

## Analytics

A stats summary is computed on demand (not stored separately):

| Metric | Definition |
|---|---|
| Total clicks | Sum of all values in `clickTracking` across the whole post |
| Top product | The pin with the highest `clickTracking` value; shows title and count |
| Current image clicks | Sum of `clickTracking` for all pins on the currently displayed image |
| Per-pin clicks | Visible alongside each pin when the Stats Panel is open in edit mode |

---

## Persistence Requirements

- Each post's data (title, images, pins, clickTracking, authorId) must survive page reloads.
- Reads must be fast enough to not cause visible delay on initial render (cache-friendly).
- The `clickTracking` map must support atomic increments (multiple concurrent viewers clicking pins at the same time).
- The author's user ID must be stored separately so permission checks cannot be spoofed.
- Legacy posts that have a single image stored in a non-array format must be silently migrated to the multi-image format on read.

---

## Validation Rules (enforce on server and client)

- A post must always have at least one image.
- An image URL must be a non-empty string.
- A pin title must be non-empty.
- A pin link must start with `https://`.
- Pin x and y must be finite numbers in [0, 100].
- Pin color must match `/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})/`.
- The `userTags` field defaults to `[]` for existing images (backward-compatible; no migration needed).
- A user tag username must be non-empty and match `^[A-Za-z0-9_-]{3,20}$`.
- UserTag x and y must be finite numbers in [0, 100].

---

## Non-Functional Requirements

- **Concurrency:** Click-tracking increments must be atomic; overlapping writes must not lose counts.
- **Security:** Only moderators / the post author (as stored server-side) may trigger mutative actions. Client role claims must not be trusted.
- **URL safety:** All outbound purchase links must be `https://`; `http://` and other schemes must be rejected.
- **Processing lock:** A single in-progress mutation must block duplicate submissions (debounce / lock on the server or via a UI loading state).
- **Error feedback:** Any failed validation or persistence error must surface a user-visible message; the UI must not silently discard input.

---

## Color Presets (reference palette)

Eight built-in swatches:
`#FF4500` (Reddit orange), `#FF6314`, `#FFD635`, `#00D47E`, `#0DD3BB`, `#46D160`, `#0079D3`, `#FF585B`

Plus a free-form custom hex input.

---

## User Journey Summary

```
Authorized user
  └─ Creates post (title + first image URL)
       └─ Enters edit mode
            ├─ (Add Product mode) Clicks grid cell → adds pin (title, link, color, x, y)
            ├─ (Tag User mode) Clicks grid cell → adds user tag (username, x, y)
            ├─ Repeats for more pins / tags / images
            └─ Clicks "Done"

Community member
  └─ Opens post
       ├─ Clicks a pin → sees product tooltip → follows link (click tracked)
       ├─ Clicks "Show All Products" → all product tooltips visible at once
       ├─ Clicks a user tag marker → sees u/username tooltip → follows Reddit profile link
       ├─ Clicks "Show All Tagged Users" → all user tag tooltips visible at once
       └─ Navigates between multiple images with arrows
```
