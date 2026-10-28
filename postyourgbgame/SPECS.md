# Homebrew GB Player — Devvit App Specification

**Status:** Draft v0.2 — 2026-10-28
**Platform:** Reddit Developer Platform (Devvit Web, `@devvit/*` 0.12.x+)
**Licence:** MIT (app source published on GitHub)

---

## 1. Overview

A Devvit app for a homebrew Game Boy community subreddit. A redditor uploads a `.gb` / `.gbc` ROM they made; the app creates a custom post containing a Game Boy emulator that runs that ROM directly inside Reddit (web, iOS, Android). Visitors play in the post, no install, no external links.

### 1.1 Goals

- Let community members publish playable homebrew ROMs as Reddit posts.
- Playable on desktop and in the Reddit mobile apps, with fullscreen on mobile.
- Pass Reddit app review on the first or second attempt by being visibly homebrew-only.
- A ROM post is a normal Reddit post: authored by the uploader, no app-side pre-approval, moderated afterwards with the subreddit's usual tools.
- Keep the whole thing inside Devvit (Redis storage, no external services).

### 1.2 Non-goals

- **No online features.** No multiplayer, no link cable emulation, no leaderboards, no cloud saves shared between users, no chat. Playback is strictly local to the viewer's device.
- No support for commercial / licensed ROMs. The app actively rejects them (see §4).
- No GBA support. Original Game Boy (DMG) and Game Boy Color only.
- No ROM downloads from the post. The post is a player, not a file host.
- No external storage (Blob, S3, HTTP fetch). Redis only.

---

## 2. Architecture

Standard Devvit Web layout:

```
.
├── src/
│   ├── client/            # webview: emulator UI, upload form, mod UI
│   │   ├── index.html     # post entrypoint (inline + expanded)
│   │   ├── player/        # emulator wrapper, canvas, controls, audio
│   │   ├── upload/        # upload flow + content warning
│   │   └── core/          # binjgb WASM + JS glue (vendored, MIT)
│   ├── server/            # Hono/Express endpoints
│   │   ├── index.ts
│   │   ├── routes/        # /api/* and /internal/*
│   │   ├── rom/           # header parsing, validation, blocklist
│   │   └── store/         # Redis key helpers
│   └── shared/            # types shared between client and server
├── devvit.json
└── vite.config.ts         # @devvit/start/vite plugin
```

| Layer | Choice | Notes |
|---|---|---|
| Client | Vanilla TS + small UI lib (Preact or none) | Keep bundle small; webview on mobile |
| Emulator core | **binjgb** (C → WASM via Emscripten) | MIT licence; DMG + CGB; no boot ROM required; audio + save state support |
| Server | Hono on Devvit's Node runtime | `@devvit/web/server`, `@devvit/redis`, `@devvit/reddit` |
| Storage | Devvit Redis (per installation) | ROM bytes + metadata + saves |
| Build | Vite + `@devvit/start/vite` | |

### 2.1 Emulator core selection

Requirement: MIT (or equivalently permissive) licence, no proprietary boot ROM, runs in a mobile webview.

| Core | Licence | Verdict |
|---|---|---|
| **binjgb** | MIT | **Selected.** Mature Emscripten build, existing web demo, DMG/CGB, rewind/save states, small WASM (~300 KB). |
| SameBoy | MIT | Strong alternative (more accurate). Emscripten build needs more work; ships MIT boot ROMs. Keep as fallback if binjgb has compatibility gaps. |
| WasmBoy | Apache-2.0 | Permissive but not MIT. Rejected per preference. |
| GameBoy-Online | GPL | Rejected (copyleft). |

The core is vendored as a prebuilt `.wasm` + glue in `src/client/core/` with its LICENSE file and the exact upstream commit recorded in `CORE_VERSION.md`.

**No Nintendo boot ROM is bundled or accepted as an upload.** binjgb boots ROMs without one.

---

## 3. User flows

### 3.1 Upload a ROM (member)

1. Subreddit menu action **"Post a homebrew ROM"**. The server checks the caller against the upload permissions (§8) and refuses with a toast ("Only moderators and approved members can post ROMs here") if not allowed.
2. Opens the app in expanded mode on the upload screen.
3. **Content warning modal** is shown first (§3.2). User must tick the attestation checkbox and press **I understand** to continue. Pressing **Cancel** closes the flow.
4. Upload form:
   - File picker (`.gb`, `.gbc`; max size from settings, default 1 MB).
   - Title (pre-filled from ROM header title, editable, ≤ 100 chars).
   - Short description (optional, ≤ 500 chars, plain text).
   - Licence of the ROM (dropdown: MIT / GPL / CC-BY / CC0 / Other-free / All rights reserved, author permission to host).
   - Source / project link (optional URL — displayed as text, not a button, to stay clear of the "no linking out" rule).
   - Colour mode hint (Auto / Force DMG / Force CGB).
5. Client reads the file as `ArrayBuffer`, base64-encodes it, `POST /api/rom/upload`.
6. Server validates (§4). On failure: error returned, shown inline, nothing stored.
7. On success the ROM is stored, the post is created **as the uploader** (`runAs: 'USER'`), and the user is navigated to it. There is no pre-approval step: a ROM post is an ordinary Reddit post. It goes through the subreddit's normal post flow (AutoMod, mod queue if the sub uses one, reports, removals) exactly like any other post.

### 3.2 Content warning (shown before every upload)

Modal text (final wording to be reviewed with mods):

> **Before you upload**
>
> This community hosts **homebrew only** — games and demos made by their authors and shared with permission.
>
> Do **not** upload:
> - Commercial or licensed games (Nintendo or third-party), including ROM hacks of them
> - Anything you did not create or do not have explicit permission to redistribute
> - Boot ROMs / BIOS files
> - Content that breaks Reddit's rules (hate, harassment, sexual content involving minors, etc.)
>
> Uploads are checked automatically and reviewed by moderators. Infringing uploads are removed and may lead to a ban from this subreddit and a report to Reddit.
>
> By continuing you confirm that **you are the author of this ROM, or you have the author's permission to publish it here**, and that it does not contain copyrighted code or assets you don't have rights to.
>
> ☐ I confirm the above
>
> [Cancel]  [I understand]

The attestation (`attestedAt`, `attestedBy`) is stored with the ROM record.

### 3.3 Play a ROM (any viewer)

1. Post renders inline in feed / post page with a **splash**: cover thumbnail (auto-captured first frame or uploaded screenshot), title, author, "▶ Play" button.
2. Viewer taps **Play**:
   - On every platform: call `requestExpandedMode()` from `@devvit/client` to open the full-screen expanded view, then start the emulator there. There is no inline play.
   - The tap counts as the user gesture that unlocks `AudioContext`.
3. Expanded view: `GET /api/rom/:postId` → base64 → `Uint8Array` → core loads ROM → run.
4. Controls: keyboard on desktop; on-screen D-pad / A / B / Start / Select on touch; gamepad API if present.
5. Pause / resume, mute, speed (1×/2×), colour palette (DMG games), save state (local), battery save (SRAM) persistence.
6. Leaving expanded mode pauses the emulator and flushes SRAM.

### 3.4 Moderator tools

Moderation happens after posting, with Reddit's own tools. Removing a ROM post through Reddit's normal UI deletes the ROM data and saves from Redis (§3.6); there is no post-level app action.

1. Subreddit menu **"ROM library"** (mod-only): list of all live ROMs in the installation with storage usage, newest first, with search by title/uploader and a per-row remove action. This is also where mods add hashes/titles to the blocklist after an incident.

### 3.5 Report

- The app has no report mechanism of its own: users report a ROM post with Reddit's report action, and those reports reach the subreddit's mod queue like any other post report. The app stores no report data.

### 3.6 Deletion

- **Post deleted** (by author or mod) → `PostDelete` trigger → ROM, metadata and saves for that post are deleted from Redis.
- **Account deleted** → handle Reddit's account-deletion trigger → delete all ROMs and saves tied to that user (uses the `user:{id}:roms` index).
- **App uninstalled** → Redis is dropped by the platform; nothing to do.

---

## 4. ROM validation (server-side)

Performed on every upload before anything is written. All checks are deterministic and logged on the ROM record.

### 4.1 Structural

| Check | Rule |
|---|---|
| Size | `32 KB ≤ size ≤ maxRomSize` (default 1 MB, mod-configurable up to 4 MB). Must be a multiple of 16 KB — actually a power of two ≥ 32 KB; warn (not reject) on padding mismatch. |
| Extension | `.gb` or `.gbc` |
| Magic | Byte-exact match of the Nintendo logo at `0x104–0x133` (required by the hardware; homebrew includes it too). Fail → reject as "not a Game Boy ROM". |
| Header checksum | `0x14D` must match the computed header checksum (`x = 0; for i in 0x134..0x14C: x = x - rom[i] - 1`). Fail → reject. |
| ROM size byte | `0x148` must match actual size. Mismatch → reject. |
| Cartridge type | `0x147` must be a known type. Unknown → reject. |
| Boot ROM detection | Size == 256 or 2304 bytes, or missing logo → reject as "boot ROM / not a cartridge image". |

### 4.2 Commercial-ROM heuristics

None of these are perfect; together with mod review they document intent.

| Check | Rule |
|---|---|
| Licensee code | Old licensee `0x14B` ∈ known commercial publishers (Nintendo `0x01`, Capcom `0x08`, …) **or** new licensee (`0x144–0x145`, when `0x14B == 0x33`) in the published list → **reject** with "This looks like a commercial release". Homebrew typically uses `0x00`, `0x33` + `"00"`/`"ZZ"`, or arbitrary values. The list lives in `server/rom/licensees.ts`. |
| Title blocklist | Header title (`0x134–0x143`, trimmed) normalised and matched against a maintained blocklist of commercial titles (`server/rom/blocklist.ts`). Match → reject. Mod-added titles (settings + "ROM blocklist" form) are matched separately → reject as "blocked by the moderators". |
| Known-hash blocklist | SHA-256 of the ROM against a small list of hashes mods add after incidents. Match → reject. |
| Global checksum | `0x14E–0x14F` is informational only (many homebrew tools leave it wrong). |

The licensee-code and built-in title checks are governed by the setting `blockCommercialRoms` (default on). When it is off, a match is accepted with a `warn` validation note (stored with the ROM record) and reviewing such uploads is the community's responsibility; some homebrew carries publisher codes or titles that collide with the lists. Mod-added titles and hashes always reject.

Rejections return a code (`REJECT_LICENSEE`, `REJECT_TITLE`, …) and a human message; the client shows it with a "Think this is a mistake? Message the mods" line.

### 4.3 Duplicate detection

SHA-256 of ROM bytes. If a ROM with the same hash already exists in this installation → reject as duplicate, link to existing post.

---

## 5. Data model (Redis, per installation)

All values are strings. Keys are namespaced with `hb:`.

| Key | Type | Value | Notes |
|---|---|---|---|
| `hb:rom:{romId}:bin` | string | base64 ROM | ~1.37× raw size; 256 KB ROM ≈ 350 KB |
| `hb:rom:{romId}:meta` | hash | see below | |
| `hb:post:{postId}` | string | `romId` | post → ROM lookup |
| `hb:user:{userId}:roms` | sorted set | `romId` scored by `createdAt` | for deletion + per-user quota |
| `hb:library` | sorted set | `romId` scored by `createdAt` | mod library view (Redis has no key scan) |
| `hb:hash:{sha256}` | string | `romId` | duplicate detection |
| `hb:save:{romId}:{userId}` | string | base64 SRAM | battery saves (≤ 128 KB) |
| `hb:stats:storageBytes` | number | running total of stored ROM + save bytes | quota display |

`hb:rom:{romId}:meta` fields: `title`, `description`, `licence`, `sourceUrl`, `uploaderId`, `uploaderName`, `postId`, `status` (`live|removed`), `sizeBytes`, `sha256`, `cartType`, `cgbFlag`, `sgbFlag`, `licenseeCode`, `headerTitle`, `validation` (JSON), `attestedAt`, `createdAt`, `colourMode`.

`romId` = first 16 hex chars of SHA-256 + 4 random chars (stable, unguessable enough).

### 5.1 Budget

Redis limits per installation: **5 MB per request, 500 MB total**. With a 1 MB cap and typical 256 KB ROMs: roughly 1,000–1,400 ROMs plus saves. Soft warning to mods at 80 %; uploads blocked at 95 % with a clear message. Writes wrap a `WriteResult` that maps Redis quota errors to a user-facing "Library is full" state instead of a crash.

Saves: max 128 KB each, max 20 saves per user per installation (oldest evicted), TTL 180 days refreshed on write.

---

## 6. API (server endpoints)

All `/api/*` routes require a logged-in user (Devvit provides `userId` in context). `/internal/*` routes are Devvit-invoked (menus, forms, triggers).

| Method & path | Who | Purpose |
|---|---|---|
| `POST /api/rom/upload` | allowed uploader (§8) | Body `{ title, description, licence, sourceUrl, colourMode, romBase64, attested: true }`. Checks upload permission, validates (§4), stores, creates the post as the caller. Returns `{ postId, romId }` or `{ error: code, message }`. |
| `GET /api/rom/:postId` | anyone who can view the post | Returns `{ romBase64, meta }` (meta without uploaderId internals). Checks post is `live` and not removed. Cache headers for the client's in-memory cache only. |
| `GET /api/rom/:postId/save` | member | Returns user's SRAM for this ROM, if any. |
| `PUT /api/rom/:postId/save` | member | Stores SRAM (base64, ≤ 128 KB). Debounced client-side (max once / 10 s and on pause/exit). |
| `GET /api/mod/library` | mod | All live ROMs with metadata, storage usage. Paginated. |
| `GET /api/mod/rom/:romId` | mod | Full details + validation for one ROM. |
| `POST /api/mod/rom/:romId/remove` | mod | `{ reason? }`. Delete data + remove post. |
| `POST /api/mod/blocklist` | mod | Add a hash or title to the installation blocklist. |
| `POST /internal/menu/upload` | Devvit | Permission check, then opens upload UI (expanded). |
| `POST /internal/menu/library` | Devvit | Opens mod library UI. |
| `POST /internal/trigger/post-delete` | Devvit | Cleanup (§3.6). |
| `POST /internal/trigger/account-delete` | Devvit | Cleanup (§3.6). |

Mod checks use `reddit.getModerators` / permission check from context on every mod route — never trust a client flag.

### 6.1 Post creation

`reddit.submitCustomPost({ subredditName, title, splash: {...}, postData: { romId }, runAs: 'USER' })`, called from `/api/rom/upload` while the uploader is the current user. **The post always belongs to the uploader**: it appears under their account, counts toward their karma, and they can edit the flair or delete it like any post. The app account never authors ROM posts. If `runAs: 'USER'` is unavailable in the current SDK, this is a blocker to resolve before M2, not something to work around with app-authored posts. Keep `postData` tiny (ROM bytes are never in `postData`).

---

## 7. Client: player

### 7.1 Modes

- **Inline (feed / post page):** splash only. No emulator, no audio, no WASM loaded. Keeps feed cheap and avoids the mobile tall-height issue (inline webviews currently render shorter than 512 px in the native apps).
- **Expanded:** emulator. Entered via `requestExpandedMode()` on **Play**. Layout: canvas scaled with integer nearest-neighbour scaling, letterboxed; touch controls below/overlaid on portrait phones; landscape uses side controls.

### 7.2 Emulator wrapper

- Loads `core/binjgb.wasm` lazily on first Play.
- `loadRom(bytes)`, `run()`, `pause()`, `reset()`, `setSpeed(n)`, `saveState()/loadState()` (in-memory + `localStorage` best-effort, wrapped in try/catch), `getSram()/setSram()`.
- Frame loop via `requestAnimationFrame`; audio via `AudioContext` + `AudioWorklet` (fallback `ScriptProcessorNode`) started only after the Play tap.
- Visibility change / expanded-mode exit → pause + SRAM flush to `PUT /save`.
- Colour mode: `cgbFlag` from header unless user overrides; DMG palette picker (4 presets).

### 7.3 Input

- Keyboard: arrows / Z X / Enter Shift (remappable, stored in `localStorage`).
- Touch: D-pad with diagonal zones, A/B, Start/Select; haptic tap via `navigator.vibrate` where available.
- Gamepad API: standard mapping.

### 7.4 Offline / resilience

If `GET /api/rom` fails, show a retry button; never leave a blank canvas. Core load failure shows "Your browser can't run the emulator" with the ROM title still visible.

---

## 8. Settings (subreddit-level, mod-editable)

### 8.1 Upload permissions

| Setting | Type | Default | Behaviour |
|---|---|---|---|
| `allowEveryone` | checkbox | **off** | When on, any logged-in member who can post in the subreddit may upload. Overrides the two settings below. |
| `allowedUsernames` | text field | empty | Comma-separated usernames (with or without `u/`, case-insensitive, whitespace trimmed) allowed to upload in addition to moderators. Ignored when `allowEveryone` is on. |
| *(implicit)* | — | — | Subreddit moderators can always upload. |

Resolution order on every upload attempt (server-side, in `/internal/menu/upload` and again in `/api/rom/upload`):

1. Caller is a moderator of the subreddit → allowed.
2. `allowEveryone` is on → allowed.
3. Caller's username (lower-cased) ∈ parsed `allowedUsernames` → allowed.
4. Otherwise → refused with the toast from §3.1 step 1. The menu item is still shown to everyone (Devvit menu visibility can't be filtered by an arbitrary list), so the refusal message must be friendly and mention that mods control the list.

Default state (both fields untouched) = **mods only**. The settings UI shows the `allowedUsernames` field under a heading "Allowed uploaders (in addition to moderators)" and the checkbox "Allow everyone to upload (ignores the list above)".

### 8.2 Other settings

| Setting | Default | Range |
|---|---|---|
| `maxRomSizeKB` | `1024` | 32–4096 |
| `maxRomsPerUser` | `10` | 1–100 |
| `extraBlockedTitles` | empty | newline list |
| `extraBlockedHashes` | empty | newline list |
| `blockCommercialRoms` | `true` | bool — apply the licensee-code and built-in title checks (§4.2); off = accept matches with a warning note |
| `contentWarningText` | default from §3.2 | multiline (mods may localise) |

---

## 9. Compliance checklist (for app review)

- [ ] `README.md` in the app listing: states homebrew-only purpose, server-side validation, mod-controlled upload permissions (mods-only by default), post-hoc moderation with standard Reddit tools, no downloads, no online features.
- [ ] Privacy policy: stores Reddit user ID + username with uploads and saves; no third-party services; data deleted on post/account deletion; no tracking.
- [ ] Terms: uploader attestation text (§3.2) reproduced.
- [ ] Reporting through Reddit's native report action (§3.5).
- [ ] Deletion handling for posts and accounts (§3.6).
- [ ] No external links as buttons; source URL shown as plain text.
- [ ] No boot ROM bundled; core licence (MIT) and app licence (MIT) included in the bundle and repo.
- [ ] App source published on GitHub with the vendored core's licence and commit.
- [ ] Licensee/title blocklist present and documented.
- [ ] No gambling, payments, or regulated content.

---

## 10. Security

- All validation is server-side; the client's checks are UX only.
- Base64 decoding with strict length check before parsing; reject anything whose decoded length ≠ declared `sizeBytes`.
- Mod routes re-check moderator status from Reddit on every call. Upload permission (§8.1) is evaluated server-side on both the menu action and the upload endpoint; the client never decides.
- ROM bytes are served only for `live` ROMs on posts the caller can view (Devvit scopes the request to the post; also check `hb:post:{postId}` exists and status).
- The save endpoint is rate-limited (Redis `incr` + `expire`).
- Description is plain text, rendered with `textContent`, never `innerHTML`.
- No `eval`, no remote scripts; the WASM core is the only binary and is shipped in the bundle.

---

## 11. Performance targets

- Inline splash: no WASM, < 100 KB JS, renders under 300 ms on mid-range Android.
- Expanded: core download + ROM fetch + first frame < 2 s on 4G.
- Steady 59.7 fps on 2020-era phones; audio buffer 4 frames (~67 ms) to avoid crackle.
- Memory: < 64 MB in the webview.

---

## 12. Milestones

| # | Milestone | Scope |
|---|---|---|
| M1 | Player prototype | Expanded-mode player with a ROM hard-coded in the bundle; touch controls; audio unlock; fullscreen on mobile. Validate in Reddit iOS/Android playtest. |
| M2 | Storage + upload | Redis storage, header validation, upload form with content warning, post creation as uploader (`runAs: 'USER'`), `GET /api/rom`. Permissions default (mods only). |
| M3 | Moderation | Upload permission settings (allowed usernames, allow everyone), library view, delete triggers. Submit for app review. |
| M4 | Scale | Per-user quotas, duplicate detection, storage budget UI, blocklist management from the library view. |
| M5 | Polish | Saves (SRAM), save states, palettes, gamepad, auto-generated cover thumbnails, keybind remapping. |

---

## 13. Open questions / to verify during M1–M2

1. Devvit's **server request body limit** for custom `/api/*` endpoints is not documented; confirm a ~1.4 MB base64 body is accepted. If not, chunk uploads (`POST /api/rom/upload/chunk`) and assemble in Redis.
2. Exact current signature of `submitCustomPost` and availability of `runAs: 'USER'` — required, since every ROM post must be authored by the uploader (§6.1).
3. Whether `requestExpandedMode()` can be triggered from the same entrypoint without a reload on all clients (changelog notes it *may* reload); design the player so a reload simply lands on the expanded player state via a URL param.
4. Behaviour of `AudioContext` inside the iOS Reddit app webview — confirm the Play tap is enough to unlock audio.
5. Whether `localStorage` persists across sessions in the native-app webview; if not, save states are session-only (SRAM is already server-side).
6. Account-deletion trigger name/shape in the current Devvit version.

---

## 14. Out of scope (explicitly)

- Link cable / multiplayer, leaderboards, shared saves, chat — **no online mode**.
- Downloads of ROM files from the post.
- GBA, Super Game Boy borders (may be revisited), ROM hacks of commercial games.
- External storage or CDN.
- Monetisation / payments.