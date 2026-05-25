# Functional Specification — Community Calendar

**Version:** 1.0  
**Date:** 2026-05-13

---

## 1. Overview

Community Calendar is an embedded, interactive calendar widget that lives inside a community post (e.g., a subreddit post). It lets privileged users (moderators) create and manage time-bound events that community members can browse. The widget is self-contained and displays without leaving the page.

---

## 2. Roles & Permissions

| Role | Description |
|---|---|
| **Moderator** | Privileged user who can create, edit, and delete events; toggle edit mode; set background image. |
| **Viewer** | Regular community member; read-only access; can click event links. |

The system determines role at render time by checking whether the current user appears in the moderator list of the community. This check is performed once per session; if the user is not authenticated, treat them as a Viewer.

---

## 3. Data Model

### 3.1 Event

The central entity. All fields are strings to preserve formatting flexibility.

| Field | Type | Required | Constraints | Default |
|---|---|---|---|---|
| `id` | string | Yes | Non-empty, unique within the calendar | Generated (random alphanumeric) |
| `title` | string | Yes | Non-empty | — |
| `description` | string | No | Supports line breaks | `""` |
| `link` | string | No | Must start with `https://` or be empty | `""` |
| `dateBegin` | string | Yes | `YYYY-MM-DD` format; valid calendar date | Today's date |
| `dateEnd` | string | Yes | `YYYY-MM-DD` format; valid calendar date; ≥ `dateBegin` | Today's date |
| `hourBegin` | string | No | Human-readable time label; no enforced format | `""` |
| `hourEnd` | string | No | Human-readable time label; no enforced format | `""` |
| `backgroundColor` | string | No | Valid CSS hex color (`#RGB` or `#RRGGBB`) | `#101720` |
| `foregroundColor` | string | No | Valid CSS hex color (`#RGB` or `#RRGGBB`) | `#F0FFF0` |

**Notes on time fields:**  
`hourBegin` and `hourEnd` are free-text labels displayed as-is. They are also parsed internally (see Section 5.4) to determine whether an event is "live." Accepted input formats for parsing: `HH:MM`, `H:MM`, `H:MM AM/PM`, `HAM/PM`, `H` (hour-only).

### 3.2 CalendarConfig

Per-calendar configuration stored alongside events.

| Field | Type | Required | Default |
|---|---|---|---|
| `titleUpcoming` | string | No | `"Upcoming events"` |
| `backgroundImageUrl` | string | No | `""` |

### 3.3 CalendarStore (persistence shape)

Events are stored as a key/value map keyed by `id`:

```
{
  "<eventId>": <Event object>,
  ...
}
```

**Storage key:** Each calendar instance has its own isolated storage namespace derived from its unique post/page identifier. Two calendars in the same community must not share event data.

**Legacy compatibility:** If a calendar was created before a known cutoff date (2024-12-05 in the reference implementation), it may use a shared legacy key (`"events"`) instead of a per-post key (`"events{postId}"`). New implementations should support reading from the legacy key if no post-scoped data exists, and write to the post-scoped key going forward.

---

## 4. Lifecycle Rules

### 4.1 Automatic Expiry

When events are loaded, any event whose `dateEnd` is strictly before today's date **must be silently removed** from the store. This cleanup happens transparently on every load.

### 4.2 Sorted Order

Events are always displayed sorted ascending by:
1. `dateBegin` (lexicographic, YYYY-MM-DD sorts correctly)
2. `hourBegin` (parsed to minutes since midnight; empty = 0)

---

## 5. Event Categorization

Events are split into two display groups before rendering.

### 5.1 "Now" Group

An event is in the **Now** group if and only if:

- `dateBegin` equals today's date (`YYYY-MM-DD`), **AND**
- Either:
  - `hourBegin` is empty/absent, **OR**
  - The current wall-clock time (local to the viewer) falls between the parsed `hourBegin` and the parsed `hourEnd`

### 5.2 "Upcoming" Group

All events that do not qualify for the Now group (including past events not yet expired, and future events).

### 5.3 Display Order

1. Now group first (live events), each marked with a "LIVE" indicator.
2. Upcoming group second, preceded by the `titleUpcoming` heading.

Within each group, events are sorted per Section 4.2.

### 5.4 Time Parsing (for categorization only)

Parse `hourBegin`/`hourEnd` to minutes-since-midnight for comparison:

| Input | Parsed value |
|---|---|
| `"14:30"` | 870 |
| `"2:30 PM"` | 870 |
| `"2PM"` | 720 |
| `"14"` | 840 |
| empty or unparseable | 0 |

---

## 6. Pagination

- Page size: **6 events per page** (applied to the combined sorted list after categorization).
- Pagination controls appear at the bottom (previous / next buttons).
- The current page and total page count are displayed (e.g., "Page 2 / 4").
- When an event is added or removed, pagination resets to page 1.

---

## 7. Features

### 7.1 Create Calendar

A Moderator can create a new calendar instance attached to a new community post. They provide a title for the post. The calendar starts empty. Each calendar is independent (separate event store).

### 7.2 View Calendar (All Users)

- Events are displayed as cards with `backgroundColor` and `foregroundColor` applied.
- Each card shows: `Title (dateBegin – dateEnd [hourBegin – hourEnd])`  
  - Dates are formatted for readability per locale (e.g., `MM/DD/YYYY`).
  - Time range appended only if `hourBegin` is non-empty.
- `description` is shown below the title, preserving line breaks.
- If `link` is set and the user is **not** in edit mode, clicking the card navigates to that URL.
- "Now" events show a prominent live indicator (e.g., red dot + "LIVE").
- Optional background image displayed behind the calendar at reduced opacity (≈ 30%).

### 7.3 Edit Mode (Moderators Only)

Moderators can toggle **edit mode**. In edit mode:

- Event cards show **Edit** and **Remove** buttons.
- Link navigation on card click is disabled (to prevent accidental navigation while editing).
- An **Add Event** button is visible.
- A **Set Background Image** button is visible.

The edit mode toggle button changes appearance to indicate the active state (e.g., checkmark icon when active).

### 7.4 Add Event

Only available in edit mode.  
Opens a form pre-filled with defaults (Section 3.1). On submit:

1. Validate all fields (Section 8).
2. Generate a unique `id`.
3. Save event to the store.
4. Show success confirmation.
5. Refresh the event list.

### 7.5 Edit Event

Only available in edit mode.  
Opens the same form pre-filled with the event's current data. The `id` field is shown but not editable. On submit:

1. Validate all fields.
2. Overwrite the existing event in the store.
3. Show success confirmation.
4. Refresh the event list.

### 7.6 Delete Event

Only available in edit mode.  
Clicking Remove on an event:

1. Deletes it from the store immediately.
2. Shows success confirmation.
3. Refreshes the event list.
4. Resets to page 1 if the current page no longer exists.

### 7.7 Background Image

Only available in edit mode.  
Opens a form to provide an image (URL or file upload, depending on implementation). Saving stores the URL in `backgroundImageUrl`. Clearing the field removes the background.

### 7.8 App-Wide Settings

Administrators can configure:

| Setting | Description | Default |
|---|---|---|
| `titleUpcoming` | Section heading shown above the upcoming events group | `"Upcoming events"` |

---

## 8. Validation Rules

All validation is enforced on form submission before any write operation.

| Field | Rule |
|---|---|
| `id` | Non-empty |
| `title` | Non-empty |
| `dateBegin` | Matches `YYYY-MM-DD`; is a valid calendar date |
| `dateEnd` | Matches `YYYY-MM-DD`; is a valid calendar date; `dateEnd >= dateBegin` |
| `link` | Empty, or starts with `https://` |
| `backgroundColor` | Empty, or valid hex (`#RGB` or `#RRGGBB`) |
| `foregroundColor` | Empty, or valid hex (`#RGB` or `#RRGGBB`) |

Validation errors must be shown to the user with a message preventing save. `hourBegin` and `hourEnd` have no enforced format; any string is accepted.

---

## 9. UI States

| State | Who sees it | Description |
|---|---|---|
| Loading | All | Shown while data is being fetched |
| View | All | Read-only calendar; events visible; no edit controls |
| Edit | Moderators | Full controls visible; link navigation disabled |
| Empty | All | Calendar with no events; Moderators see "Add Event" prompt |

---

## 10. Confirmation Messages

The system must display a short success/error notification after each write operation:

| Operation | Success message (example) |
|---|---|
| Add Event | "Event added successfully" |
| Edit Event | "Event updated successfully" |
| Delete Event | "Event removed" |
| Set Background | "Background updated" |

---

## 11. Localization

- Date display should adapt to the viewer's locale (locale-aware date formatting).
- The `titleUpcoming` setting allows communities to customize section labels (useful for non-English communities).
- Time fields are user-entered labels and not formatted by the system.

---

## 12. Storage Interface (Implementation Contract)

Implementations must provide the following persistence operations. The storage backend is arbitrary (Redis, PostgreSQL, a document store, etc.) as long as the interface is fulfilled.

| Operation | Description |
|---|---|
| `getEvents(calendarId)` | Returns all non-expired events for the given calendar, as a map `{ id → Event }`. Must apply expiry cleanup (Section 4.1). |
| `saveEvent(calendarId, event)` | Upserts one event (insert or replace by `id`). |
| `deleteEvent(calendarId, eventId)` | Removes the event with the given id. |
| `getConfig(calendarId)` | Returns the `CalendarConfig` for the given calendar. |
| `saveConfig(calendarId, config)` | Persists the `CalendarConfig`. |

`calendarId` is a stable unique identifier for each calendar instance (e.g., the post ID or page slug).

---

## 13. Out of Scope

The following are explicitly excluded from this specification:

- Timezone conversion or timezone-aware scheduling.
- Event RSVP / attendance tracking.
- Recurring events.
- Notifications or reminders.
- Comment threads on events.
- Role management (moderator list is managed externally by the community platform).
