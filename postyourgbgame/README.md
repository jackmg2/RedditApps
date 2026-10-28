# PostYourGBGame - A GB/GBC Emulator For HomeBrew Communities

Play homebrew Game Boy and Game Boy Color games right inside your Reddit Community.

Let your Redditors post a `.gb` / `.gbc` ROM **they made**, and the app turns it into a post with a built-in emulator. 

Anyone can play it on the web or in the Reddit apps. There's nothing to install, no downloads and no external links.

## Posting a ROM

1. Use the subreddit menu **Post a homebrew ROM**. A form asks for the post title and an optional short description, then creates the post in your name.
2. Open the post and tap **Upload ROM**. After the content warning, pick the `.gb`/`.gbc` file, its licence, an optional source link and the color mode.
3. Once uploaded, the post is playable and **the ROM can't be changed**. 
To post a new version, delete the post and create a new one; deleting the post deletes its ROM.

Each member can have one post waiting for its ROM at a time. A post still without a ROM one hour after it was created is removed automatically.

## For moderators

1. Choose who can upload under **Settings**. The default is **moderators only**.
  * *Allowed uploaders*: comma-separated usernames, in addition to mods.
  * *Allow everyone to upload*: any member who can post (this ignores the list).

2. The wiki page **homebrew-roms** (the name is a setting) lists every playable ROM: title linked to its post, author, system, size, licence and date, newest first. 

The app rewrites it whenever a ROM is posted or removed, and once a day. Manual edits are overwritten. Only moderators can edit it. The subreddit wiki must be enabled.

3. Moderate ROM posts like any other post. Removing or deleting a ROM post also deletes the ROM data and its saves, and drops it from the wiki page.

4. **ROM blocklist** (subreddit menu) edits the blocked header titles and ROM hashes, and shows how much of the 500 MB storage is used.

5. **Homebrew only**

Every upload goes through a content warning and an author attestation. The server then checks the ROM before storing anything:

* **Structure**: `.gb`/`.gbc` extension; size between 32 KB and the limit, in 16 KB banks; Nintendo logo bytes present; correct header checksum; ROM-size byte matching the file; a known cartridge type that the player supports. Boot ROM / BIOS images are rejected.
* **Commercial-release heuristics**: commercial publisher licensee codes and a
  built-in list of commercial header titles. Moderators
  can turn both off for homebrew that trips them; matches are then accepted
  and reviewing those uploads is up to the community.
* **Moderator blocklists**: header titles and SHA-256 hashes added by the
  moderators, always enforced.
* **Duplicates**: a ROM that is already posted in the subreddit is refused,
  with a link to the existing post.

## Player

* Emulator core: [binjgb](https://github.com/binji/binjgb) (MIT), vendored unmodified in [`public/core/`](public/core/). See [`CORE_VERSION.md`](public/core/CORE_VERSION.md). No boot ROM is bundled.
* The feed shows a lightweight splash (cover, title, author) without WebAssembly. **Play** opens the full-screen player.
* Controls: keyboard (remappable), on-screen D-pad / A / B / Start / Select on touch devices, and gamepads.
* Pause, mute, 2× speed, four DMG palettes, save states (stored on your device), and battery saves (stored per user, kept 180 days).
* No online features: no multiplayer, link cable, leaderboards or shared saves.

## Privacy

* Post is posted under username, it can be managed by the user himself.
* No share features is implemented, only default Reddit ones are available.
* All data stays in the app's Reddit-hosted storage for the installing subreddit. There are no third-party services, no tracking and no analytics.
* When a ROM post is deleted or removed, its ROM and saves are deleted and it leaves the wiki page. A daily job deletes the ROMs and saves of accounts that no longer exist. Uninstalling the app drops all of its data.
* Save states and key bindings are kept only in your browser's local storage.

## You may also like

Other Reddit apps by the same author:

* [🥁 Rebbeat — A drum machine that lives right inside your subreddit.](https://developers.reddit.com/apps/rebbeat-app)
* [MIDI Mini Music — A playful musical instrument for your subreddit](https://developers.reddit.com/apps/midi-mini-music)

### Mod tools
* [FlairAndApprove — One-click user verification: flair, approve and welcome users](https://developers.reddit.com/apps/flairandapprove)
* [Ban Extended — Ban a user and remove all of their content](https://developers.reddit.com/apps/ban-extended)
* [El Commentator — Quick comment templates for moderators](https://developers.reddit.com/apps/el-commentator)
* [Contributors Tracker — Track your best contributors](https://developers.reddit.com/apps/contributorstracker)
* [Ratio Bot — Motivate users to contribute with post ratios](https://developers.reddit.com/apps/ratio-bobo)

### Community helpers
* [Community Links — Interactive link boards for your community](https://developers.reddit.com/apps/communitylinks-2)
* [Aye Aye Calendar — Display the upcoming events of your community](https://developers.reddit.com/apps/ayeayecalendar)
* [Shoppit — Interactive shopping posts with clickable product pins](https://developers.reddit.com/apps/shoppit-app)