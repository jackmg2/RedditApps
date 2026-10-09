# Rebbeat-app — Specification

A Reddit Devvit app that turns a post into a 16-step drum machine. Members add
instruments, pick a tempo, tap cells to program a beat, listen to it, and share
it as a comment or as a short text code anyone can paste back in.

Sibling of [midi-mini](../midi-mini/) (Devvit name `midi-mini-music`): same
project layout, build tooling, toolkit adoption, splash → game flow, share-as-
comment flow and toast/modal UI. Where this document says "as midi-mini", reuse
that code or pattern unchanged.

Status: **draft v1 — 2026-10-08**. Open questions are listed at the end.

---

## 1. Goals and non-goals

**Goals**

1. Anyone who opens the post can build a beat in under a minute with no
   instructions: tap cells, press play.
2. Beats are shareable as plain text that survives a Reddit comment, and
   loadable back into the app with one paste.
3. Timing is tight enough to sound like a real step sequencer (no audible jitter
   at 140 BPM on a mid-range phone).
4. Follow the four workspace rules (`CLAUDE.MD`) via the shared toolkit.

**Non-goals (v1)**

- No audio sample files: every instrument is synthesized with Web Audio
  (small bundle, no licensing, same approach as midi-mini).
- No song mode / multiple patterns, no per-step velocity, no swing, no
  recording of live taps. The share format reserves room for some of these
  (see §7.3).
- No server-side audio rendering or MP3 export.
- No user accounts beyond what Devvit provides; nothing is stored per user
  except a rate-limit key.

---

## 2. The reference screenshot (`Rebbeat.png`)

The screenshot defines the look. Reading it top to bottom:

| Area | What it shows | Spec interpretation |
|---|---|---|
| Top-left orange square | Stop button (the beat is playing) | Play/Stop toggle: ▶ when stopped, orange ■ while playing |
| Black LCD panel | `00:03:09`, a 16-bar meter, `BPM 140` | Transport display: elapsed time `mm:ss:cc`, 16 position bars (one lights per step), tappable BPM |
| Top-right ↶ ↷ | Undo / redo | Undo/redo stack of grid edits |
| `TRACKS` column | 7 instrument icons + `+` row | One row per instrument; `+` opens the instrument picker |
| Column header | `1 · · · · · ·` | 16 steps; step 1 and every 4th step labelled, others dotted |
| White discs | Active steps | Tap a cell to toggle; disc with soft shadow when on |
| Row shading | Alternating light rows, one darker row | Zebra rows; the row under the pointer/last edited is highlighted |
| Right edge cut off | Grid wider than viewport | Grid scrolls horizontally when it cannot fit (phones) |

Visual language: light grey canvas, rounded card, no text labels on tracks
(icons only, with `aria-label`), monospace LCD. Orange (`#FF4500`-ish, Reddit
orange) is the only accent colour and is reserved for "playing" state and the
current-step highlight.

---

## 3. User stories

- As a **moderator**, I create a Rebbeat post from the subreddit menu, give it a
  title, and it appears in the feed.
- As a **member**, I open the post, press *Start*, and get an empty grid with a
  starter kit (kick, snare, hi-hat) so I can hear something within two taps.
- I **add an instrument** from a palette and it appears as a new row.
- I **remove** an instrument I no longer want.
- I **set the BPM** by tapping the number and typing, or with − / + steps.
- I **tap cells** to turn steps on and off, while the beat is playing or not.
- I **press play** and hear the loop; the current step is highlighted.
- I **undo / redo** cell edits.
- I **share** my beat as a comment under the post (with an optional message).
- I **copy** my beat code to paste anywhere (another comment, DM, another post).
- I **load** a beat by pasting a code from a comment.
- As a **moderator**, when I remove the post, the app forgets about it
  (rule 1). Shared-beat comments are the member's own, so removing one is a
  normal comment removal.

---

## 4. Functional specification

### 4.1 Post creation (moderators)

As midi-mini:

- `devvit.json` menu item, `location: "subreddit"`, `forUserType: "moderator"`,
  label **"Create a new Rebbeat post"**.
- The handler shows a form with one required `title` field, default
  `"Rebbeat — make a beat!"` (rule 3, `buildTitlePromptForm` / `extractTitle`
  from the toolkit may replace the inline form).
- On submit: `reddit.submitCustomPost({ title })`, then `trackPost(post.id)`,
  then `navigateTo` the post.
- Nothing is created on `onAppInstall` (rule 2).

### 4.2 Splash → game

As midi-mini: `splash.html` is the inline feed view with a single
**"🥁 Start the beat!"** button. The click is the user gesture that unlocks
`AudioContext`. On native clients it calls `requestExpandedMode(e, 'game')`;
on web it navigates to `game.html`.

Splash content: app name, one-line description, three hints (👆 tap cells,
▶ play, 💬 share). A static 3-row × 8-column mini grid drawn in CSS gives the
feed a preview of what is inside.

### 4.3 The grid

- **16 steps** per pattern (one bar of 16th notes at the chosen BPM). The data
  model carries a `steps` field so 32 can be added later without a format bump.
- **Rows** = tracks, in user order. Max **8** tracks. Min 0 (an empty grid is
  allowed but Play does nothing audible).
- **Cell tap** toggles the step. No drag-painting in v1 (it conflicts with
  horizontal scroll on touch). Toggling is immediate even during playback.
- **Step header**: `1`, `·`, `·`, `·`, `5`, … (numbers on beats 1/5/9/13).
- **Current step**: while playing, the column of the current step gets a faint
  orange tint and the matching LCD bar lights. Updated via
  `requestAnimationFrame` against scheduled audio times (never via the audio
  callback).
- **Layout**: track column is sticky-left (56 px). Cells are square,
  `clamp(28px, (viewport − 56px) / 16, 48px)`. Below 28 px the grid becomes
  horizontally scrollable instead of shrinking further. Rows are 56 px tall.
- Row zebra striping; the hovered row (pointer) or last-tapped row (touch) is
  shaded one step darker, as in the screenshot.

### 4.4 Tracks and instruments

- The `+` row opens the **instrument picker**: a modal grid of icons + names
  (§6). Picking one appends a track (if < 8) and closes the picker. Duplicates
  are allowed.
- Tapping a track icon opens a small **track menu**: *Preview* (plays one hit),
  *Mute* toggle, *Move up / down*, *Remove*. Remove asks no confirmation but is
  undoable.
- Mute is visual (icon dimmed) and audible, and is **not** part of the share
  code.
- New posts start with a **starter kit**: Kick, Snare, Closed hi-hat, all
  empty. (Decided: empty rather than a demo pattern, so the first share is
  clearly the user's own.)

### 4.5 Transport

- **Play / Stop** toggle, keyboard `Space`. Playback loops the 16 steps until
  stopped. Stop resets to step 1.
- **Elapsed time** `mm:ss:cc` counts from Play; resets on Stop.
- **BPM**: tap the number to get an inline numeric input (keyboard `Enter` /
  blur commits, `Esc` cancels); `−` / `+` buttons step by 1, long-press repeats;
  range **40–240**, default **120**. Changing BPM during playback takes effect
  from the next scheduled step (no restart).
- When the post is **scrolled out of view or the tab is hidden**, playback
  stops (as midi-mini's inline-feed silence rule).

### 4.6 Undo / redo

- History of grid-affecting actions: cell toggle, add track, remove track,
  move track, BPM change, load code, clear. Max **50** entries; redo stack is
  cleared on a new action.
- Keyboard: `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` / `Ctrl/Cmd+Y`.
- Buttons are disabled (greyed) when the corresponding stack is empty.

### 4.7 Sharing

Two paths, both from a **Share** button in the header.

**Share modal** contains:

1. The beat **code** in a read-only, auto-selected `<textarea>` (monospace).
2. **Copy** button → `navigator.clipboard.writeText`. If the call throws or the
   API is unavailable inside the Devvit iframe, fall back to selecting the
   textarea content and showing a toast *"Select the code and copy it"*.
3. An optional **message** field (max 200 characters, plain text).
4. **Post as comment** button → `POST /api/beat/share` (§8.2). Requires a
   logged-in user; the button is hidden when `/api/init` reports no `userId`.

Sharing an **empty** pattern (no active step) is refused with a toast.

**Comment layout** (posted under the member's own account with
`runAs: 'USER'`, unlike midi-mini):

```
{message}

🥁 **Rebbeat** 🥁
- Tempo: 140 BPM
- Tracks: Kick, Snare, Closed hat, Cowbell
- Created by: u/{username}

**Beat code:**
```
BB1;140;16;kick:8888;snare:0808;hhc:aaaa;cowb:0100
```

*Copy the code above and use "Load" in the post to hear this beat!*
```

### 4.8 Loading a beat

- **Load** button in the header opens a modal with a textarea: *"Paste a beat
  code from a comment"*.
- The parser (§7.2) accepts the bare code and also tolerates being handed the
  whole comment (it extracts the first `BB1;…` token). Whitespace and
  surrounding backticks are ignored.
- On success the grid, tracks and BPM are replaced (one undo entry), a toast
  reports *"Loaded N tracks at X BPM"*, and the picker closes. On failure a
  toast says *"That doesn't look like a Rebbeat code"* and nothing changes.
- If the sequencer is playing, loading keeps it playing with the new pattern.

### 4.9 Persistence of the working beat

- The current beat is saved to `localStorage` (keyed by post id) on every
  change, and restored on next open, so an accidental close does not lose work.
  No server storage of drafts.
- **Clear** button (header overflow menu) empties all steps, keeps tracks and
  BPM, and is undoable.

### 4.9b Moderator default beat

- A post opens on its **default beat**: the starter kit unless a moderator
  set one. A member's local draft (§4.9) always wins over the default.
- Moderators set it with the optional *Starting beat code* field of the
  create-post form (validated before the post is created), or in-app via
  **⋯ → Set as this post's default beat** (stores the current grid) and
  **⋯ → Reset default to the demo beat**. Both in-app items are only shown
  when `/api/init` returns `canSetDefault`; `POST /api/beat/default`
  re-checks `checkModPermission(['posts'])`.
- The default is never written to the visitor's draft until they edit, so a
  later default change reaches anyone who hasn't touched the grid.
- **⋯ → Start over from the default beat** (everyone) loads the post default
  as an undoable edit.

### 4.10 Community beats (stretch, v1.1)

Every successful comment share is also appended to a per-post redis list
(`beat:shared:{postId}`, capped at 100, newest first). A **Browse** panel in
the app lists them (author, tempo, track count, relative time) and loads one
on tap. The comments are the members' own, so entries are not removal-synced:
the panel must skip comments that are removed or deleted.
Left out of v1 to keep scope tight; the data is cheap to collect from day one
so it can ship later without a backfill.

---

## 5. Audio engine

All instruments are synthesized with Web Audio, scheduled ahead of time.

### 5.1 Scheduler ("two clocks" pattern)

- A `setInterval` **tick every 25 ms** looks **100 ms ahead** and schedules
  every step whose time falls in that window using `AudioContext.currentTime`.
- Step duration = `60 / bpm / 4` seconds. Next-step time is advanced from the
  previous *scheduled* time, never from `Date.now()`, so drift does not
  accumulate.
- Each scheduled step is pushed to a `{ step, time }` queue that the rAF loop
  drains to move the visual cursor.
- BPM changes alter the step duration used for the *next* increment only.
- Each hit is a fresh short-lived node graph (oscillators / buffer source →
  gain envelope → track gain → master). Nodes are stopped and disconnected via
  `onended`.

### 5.2 Master chain

`track gains → DynamicsCompressor (−18 dB, ratio 4) → master gain (0.8) →
destination`. No reverb or delay (muddies drums at 140 BPM).

### 5.3 Instrument recipes

| id | Name | Recipe (all times ms, pitches Hz) |
|---|---|---|
| `kick` | Kick | sine 150→40 exp sweep over 120, gain decay 300; click: 1 ms noise burst |
| `snare` | Snare | white noise bandpass 1.8 kHz decay 180 + triangle 180 Hz decay 80 |
| `clap` | Clap | 3 noise bursts 10 ms apart then tail, bandpass 1.2 kHz, decay 150 |
| `rim` | Rimshot | square 450 Hz, 15 ms + highpass noise 10 ms |
| `hhc` | Closed hat | 6 square oscillators (metallic ratios) → highpass 7 kHz → bandpass 10 kHz, decay 50 |
| `hho` | Open hat | same as closed, decay 350; triggers a *choke*: any ringing open hat on the same track stops when a closed hat plays |
| `tomL` | Low tom | sine 110→70 sweep, decay 350 |
| `tomM` | Mid tom | sine 170→110 sweep, decay 300 |
| `tomH` | High tom | sine 260→170 sweep, decay 250 |
| `crash` | Crash | noise + 4 detuned squares → highpass 3 kHz, decay 1200 |
| `ride` | Ride | metallic squares → bandpass 6 kHz, decay 600, quieter |
| `cowb` | Cowbell | squares 587 + 845 Hz → bandpass 1 kHz, decay 250 |
| `shak` | Shaker | noise → bandpass 9 kHz, very short attack, decay 90 |
| `clav` | Clave | sine 2.5 kHz, decay 40 |
| `bass` | Bass pluck | sawtooth 55 Hz → lowpass sweep 800→120, decay 250 (adds a tonal layer) |
| `blip` | Blip | sine 880 Hz, decay 60 (melodic accent) |

Each has an inline SVG icon (24 px, 1.5 px stroke, currentColor). Icons live
in a single `icons.ts` map so the picker, the track column and the comment
template share them.

The `kick`, `snare`, `hhc` recipes are the quality bar: tune them first and
compare against a real 808/909 reference before building the rest.

---

## 6. Instrument palette order

Picker shows them in this order, 4 per row: Kick, Snare, Clap, Rimshot ·
Closed hat, Open hat, Crash, Ride · Low tom, Mid tom, High tom, Cowbell ·
Shaker, Clave, Bass pluck, Blip.

---

## 7. Data model and share format

### 7.1 In-memory model (`src/shared/beat.ts`)

```ts
export type InstrumentId =
  | 'kick' | 'snare' | 'clap' | 'rim' | 'hhc' | 'hho'
  | 'tomL' | 'tomM' | 'tomH' | 'crash' | 'ride' | 'cowb'
  | 'shak' | 'clav' | 'bass' | 'blip';

export type Track = {
  instrument: InstrumentId;
  steps: boolean[];   // length === Beat.steps
  muted: boolean;     // UI only, never serialized
};

export type Beat = {
  version: 1;
  bpm: number;        // 40..240 integer
  steps: 16;          // reserved: 32 later
  tracks: Track[];    // 0..8
};
```

### 7.2 Share code (`BB1`)

Human-readable, markdown-safe (no `|`, `*`, `_`, `#`, `<`), fits on one line:

```
BB1;<bpm>;<steps>;<inst>:<hex>[;<inst>:<hex>]*
```

- `BB1` — format tag + version. A future `BB2` may add fields; a `BB1` parser
  must reject unknown tags rather than guess.
- `<bpm>` — integer 40–240.
- `<steps>` — `16` (parser also accepts `32` for forward compatibility and
  rejects anything else).
- `<inst>` — an `InstrumentId`. Unknown ids make the whole code invalid (no
  silent dropping, so people are not surprised by missing tracks).
- `<hex>` — `steps / 4` hex digits, case-insensitive. Bit `steps − 1 − i`
  (most significant first) is step `i`, so the leftmost hex digit is steps 1–4.
  `8888` = a hit on every beat; `aaaa` = every 8th note.

Example (the screenshot-like beat): `BB1;140;16;kick:8a8a;snare:0808;hhc:ffff;cowb:0100`

Limits: ≤ 8 tracks, total length ≤ 200 characters. The parser is a single
pure function `parseBeatCode(text): Beat | null` with a `formatBeatCode(beat)`
inverse; both live in `src/shared/beat.ts` so the **server validates with the
same code** before posting a comment.

### 7.3 Reserved extensions (not in v1)

Noted so v1 code does not paint us into a corner:

- Velocity / accent: a second hex group per track `kick:8888/8080` (accented
  steps).
- Swing: an optional `sw<0-100>` token after `<steps>`.
- 32 steps: already accepted by the grammar.

---

## 8. Architecture

### 8.1 Project layout

Hybrid family as midi-mini: Devvit Web, Hono server, vite build via
`@devvit/start`. Node ≥ 22.2, same dependency versions as midi-mini at the time
of scaffolding.

```
Rebbeat/
  devvit.json
  package.json                 name: "Rebbeat"   (verify availability, §11)
  vite.config.ts  tsconfig.json  tools/tsconfig.*.json  eslint.config.js  .prettierrc
  assets/Rebbeat.png           marketing icon (derive from the screenshot's kick icon)
  src/
    shared/
      api.ts                   request/response types (§8.2)
      beat.ts                  Beat model, parseBeatCode, formatBeatCode, INSTRUMENTS metadata
    client/
      splash.html / splash.css / splash.ts
      game.html / game.css / game.ts        bootstrap → new BeatApp()
      beatApp.ts               UI state, grid rendering, modals, undo/redo, localStorage
      sequencer.ts             lookahead scheduler, play/stop, bpm, cursor queue
      drumSynth.ts             AudioContext, master chain, one function per InstrumentId
      icons.ts                 SVG icon map
      apiClient.ts             fetchInit, shareBeat (as midi-mini)
      dom.ts                   byId helper (copy from midi-mini)
    server/
      index.ts                 Hono app: /api, /internal/menu, /internal/triggers
      core/post.ts             createPost (copy from midi-mini)
      routes/menu.ts           post-create form + submit
      routes/api.ts            /init, /beat/share
      routes/triggers.ts       removal sync wiring
      toolkit/                 copied by `node _shared/sync-toolkit.mjs sync Rebbeat`
```

### 8.2 API (`src/shared/api.ts`)

| Method & path | Request | Response |
|---|---|---|
| `GET /api/init` | — | `{ type: 'init', postId, canShare: boolean, canSetDefault: boolean, defaultBeat: string \| null }` (`canShare` = a `userId` exists in context; `canSetDefault` = mod with `posts`) |
| `POST /api/beat/default` | `{ code: string \| null }` | `{ type: 'defaultBeatSet', defaultBeat: string \| null }` (mods with `posts` only, 403 otherwise; `null` restores the starter kit) |
| `POST /api/beat/share` | `{ code: string; message: string }` | `{ type: 'beatShared', commentId }` |
| any | — | `{ status: 'error', message }` with 4xx |

`POST /api/beat/share` server behaviour:

1. Reject if no `postId` (400) or no `userId` (401).
2. `parseBeatCode(code)`; reject invalid (400) or empty (no active step, 400).
   The server never trusts the client's rendering of the code: it re-formats
   the parsed beat with `formatBeatCode` and posts *that*.
3. Trim `message` to 200 chars; strip leading `#`, `>` and `-` so it cannot
   become a heading/quote/list; if empty use *"Check out my beat! 🥁"*.
4. Rate limit: redis key `beat:ratelimit:{postId}:{userId}` with 30 s TTL;
   429 with a friendly message if present.
5. `reddit.getCurrentUsername()` for the "Created by" line (username appears
   only in the comment, never in the app UI, as midi-mini).
6. `reddit.submitComment({ id: postId, text, runAs: 'USER' })`. The comment
   is the member's, not the app's, so it is not tracked (`userGeneratedContent`
   only applies to `submitCustomPost`).
7. Stretch: `redis.lPush('beat:shared:{postId}', JSON.stringify({ commentId,
   code, username, ts }))` + `lTrim` to 100 (§4.10).

### 8.3 `devvit.json`

Same shape as midi-mini's: `post.entrypoints.default = splash.html`,
`post.entrypoints.game = game.html`, `server.entry = index.cjs`, the single
menu item + `forms["create-post"]`, and the two triggers:

```json
"triggers": {
  "onModAction": "/internal/triggers/on-mod-action",
  "onPostDelete": "/internal/triggers/on-post-delete"
}
```

`dev.subreddit`: a new dev sub, suggested `Rebbeat_dev` (create it before the
first playtest).

### 8.4 Redis keys

| Key | Type | Purpose | TTL / cap |
|---|---|---|---|
| `app:content:*` | toolkit | tracked posts | managed by `contentTracker` |
| `beat:ratelimit:{postId}:{userId}` | string | share rate limit | 30 s |
| `beat:shared:{postId}` | list | community beats (stretch) | 100 entries |
| `beat:default:{postId}` | string | moderator-set default beat (BB1, server-formatted) | none; deleted with the post |

The removal-sync `cleanup` runs for posts only: it calls `untrack`, clears
`beat:default:{postId}` and deletes the whole `beat:shared:{postId}` list.

---

## 9. Workspace-rule compliance

| Rule | How Rebbeat satisfies it |
|---|---|
| 1. Removal sync | `createRemovalSync({ isAppContent: isTracked, cleanup, commentActions: [] })` wired to `onModAction` and `onPostDelete`, plus `sweepRemovedAppPosts` on `onAppUpgrade`; the post is tracked at creation and stays tracked until its delete succeeds, so a failed delete is retried. Shared comments are posted as the member (`runAs: 'USER'`), so they are not app content and are not synced. When the post is removed, `cleanup` also author-deletes any comment under it written by the app account (legacy shares, or shares made while posting as the user was unavailable), found by author since they were never tracked. |
| 2. No post at install | No `onAppInstall` trigger at all. |
| 3. Title prompt | Mod menu form with a required, prefilled `title`. |
| 4. Permission checks | Creating the post is gated by `forUserType: "moderator"` as midi-mini. Setting the post's default beat (§4.9b) calls `checkModPermission(['posts'])` on the server. Nothing bans, removes or flairs. |

Toolkit adoption: `node _shared/sync-toolkit.mjs sync Rebbeat` after
scaffolding; `check --all` before every release. Never edit
`src/server/toolkit/`.

---

## 10. Non-functional requirements

- **Timing**: scheduled-vs-actual jitter < 5 ms (verifiable by logging
  `ctx.currentTime` in `onended`). No `setTimeout`-driven audio.
- **Latency of a cell toggle during playback**: the change is heard at the
  next pass of that step (no need to re-schedule the lookahead window).
- **Bundle**: client JS < 60 kB gzipped; no audio assets, no fonts beyond the
  system stack and a monospace fallback for the LCD.
- **Mobile**: usable at 360 px wide (8 cells visible, horizontal scroll);
  touch targets ≥ 40 px; no double-tap zoom (`touch-action: manipulation`).
- **Accessibility**: every cell is a `<button role="switch" aria-checked>`
  labelled *"{Instrument}, step {n}"*; arrow keys move focus in the grid,
  `Enter`/`Space` toggles; `prefers-reduced-motion` disables the pulse
  animation on the current step; colour contrast ≥ 4.5:1 for text.
- **Privacy**: no personal data stored; the username appears only in the public
  comment the user explicitly asked for. The share comment can contain only a
  validated beat code and a 200-char message, and it is reportable like any
  comment.
- **Failure modes**: audio init failure → toast + grid still editable and
  shareable; share API failure → toast, modal stays open with the code so the
  user can still copy it.

---

## 11. Open questions
1. **Starter kit**: A prefilled demo beat
   people can edit immediately. Demo is more fun, empty makes ownership clearer.
3. **Pattern length**: 16 steps with a 16/32 toggle.
5. **Theme**: light and dark

---

## 12. Milestones

1. **Scaffold** — copy midi-mini tooling, `devvit.json`, splash, server routes,
   toolkit sync; `npm run type-check && npm run build` green; empty game page.
2. **Synth + sequencer** — `drumSynth.ts` with kick/snare/hat, `sequencer.ts`
   lookahead loop, Play/Stop, BPM. Verified by ear on desktop and phone.
3. **Grid UI** — tracks, cells, picker, track menu, cursor, undo/redo,
   localStorage draft. Matches the screenshot.
4. **Share / Load** — `beat.ts` parser + formatter with unit tests (vitest, as
   contributorstracker), share modal, copy fallback, comment share endpoint,
   load modal, rate limit.
5. **Remaining instruments** — the other 13 recipes + icons.
6. **Release** — README in the midi-mini style (what / why / how to install /
   how to play / privacy / "You may also like"), marketing icon, `devvit
   upload`, add a row to the workspace `README.md` table.
