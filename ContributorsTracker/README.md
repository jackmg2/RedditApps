# Contributors Tracker

**Automatically track and showcase community contributions on your subreddit.**

Contributors Tracker watches the posts in your community and keeps a running record of
who contributes what. When someone makes a tracked post, the app replies with a tidy,
auto-updating history of everything that member has contributed — so recognition,
track records, and accountability are always one click away.

It runs quietly in the background. Once you tell it which post flairs to track, there is
nothing else to manage.

> ### ⚠️ Where to configure what
>
> Contributors Tracker is configured in **two different places** — this is the most
> common source of confusion:
>
> | You want to… | Go to… |
> |---|---|
> | **Choose which flairs to track** and the tracking mode (phrase / requested-by) | Your subreddit's **mod menu** (the **⋯** menu on the subreddit page) → **"Contributors-Tracker: Configure tracking"** |
> | Change the **wording** of the history comment, the **leaderboard** options, or whether comments are **posted automatically** | The app's **Settings** page (**Mod Tools → Installed apps → Contributors Tracker → Settings**) |
>
> **Flairs are *not* on the Settings page.** If you open the app's settings looking for a
> flair picker, you're in the wrong place — close it and use the subreddit mod menu
> instead. Nothing is tracked until at least one flair has been configured there.

## What it does

- **Tracks contributions by flair.** You choose which post flairs count as contributions.
  Every matching post is recorded automatically.
- **Builds a per-member history.** On each tracked post, the app leaves (and keeps
  updated) a comment with a clean table of that member's contributions in your subreddit.
- **Ranks your contributors.** Each history comment can show the member's standing, and
  the app keeps a ranked leaderboard on your subreddit's wiki.
- **Stays accurate over time.** Edits, flair changes, and deletions are handled
  automatically, so the history always reflects reality.

## Why we built it?

- 🏆 **Recognize and reward** your most active contributors with a visible track record
  and a community leaderboard.
- 👀 **Vet at a glance.** See a member's full contribution history right on their post.
- 🧾 **Cut the manual record-keeping.** No more maintaining contributor lists by hand.
- 🙌 **Credit the right people.** Capture who *requested* or *inspired* a contribution,
  not just who posted it.
- 🎛️ **Fits your community.** Works with *your* flairs and *your* terminology — fully
  configurable, no code required.

## Key features

- **Flair-based tracking** — pick any post flairs in your subreddit to track.
- **Two flexible modes:**
  - *Phrase matching* — count posts whose title contains a phrase you specify
    (or leave it empty to track every post with that flair).
  - *Requested-by tracking* — track every flaired post and automatically capture any
    `u/username` mentioned in the title (multiple contributors supported).
- **Auto-updating history tables** — each contributor's comment refreshes as they post,
  showing their most recent contributions with older entries summarized.
- **Leaderboard standing** — every history comment can include the member's standing,
  such as *"u/example is in the top 12% of our members!"* (members below the top half get
  a neutral contribution count instead).
- **Wiki leaderboard** — the app maintains a ranked leaderboard page on your subreddit's
  wiki (`wiki/contributors-leaderboard` by default), refreshed automatically as
  contributions come and go. See [Leaderboard](#leaderboard) below.
- **Moderator tools on every post** — a **"Review contribution"** post menu lets mods set
  the proper title (phrase mode) or the requested-by usernames (requested-by mode), or
  remove a contribution; a **"Post contribution history"** post menu posts or refreshes
  a member's history comment on demand — all straight from the post.
- **Optional automatic comments** — keep tracking silently and only post history
  comments when a mod asks for one, if that suits your community better.
- **Self-maintaining** — handles new posts, flair updates, and deletions automatically.
- **Backfills existing history** — new members are caught up from their past posts in
  safe, gradual batches, even on large, high-volume subreddits.
- **Privacy-respecting** — only reads public post data, and only moderators can configure
  it or review contributions.

## How it works

1. **A member posts** with one of your tracked flairs.
2. **Contributors Tracker records it** based on the flair, and works out what was
   contributed (and, in requested-by mode, who it was credited to). If the title doesn't
   give it enough to go on, the post is still recorded and flagged for review in the
   comment rather than dropped.
3. **It replies with the member's history**, or updates the existing history comment if
   one is already there — including their current leaderboard standing.
4. **It keeps everything in sync** as posts are edited, re-flaired, reviewed from the
   post menu, or removed — and refreshes the wiki leaderboard shortly after each change.

## Getting started

1. **Install** Contributors Tracker on your subreddit (you'll need moderator access).
2. Go to your subreddit page, open the **mod menu** (the **⋯** menu) and choose
   **"Contributors-Tracker: Configure tracking."**
   *This is the only place where flairs are configured — not the app's Settings page.*
3. **Pick the flairs** you want to track and a **tracking mode** (phrase matching or
   requested-by). In phrase mode, optionally list the title phrases to match.
4. **Save** — that's it. The app starts tracking new posts immediately and quietly
   backfills existing contributors over time. The wiki leaderboard page is created
   automatically with the first tracked contribution.

You can reopen **"Configure tracking"** anytime to add flairs, change a mode, or stop
tracking a flair.

Everything else — the wording of the comments, the leaderboard, automatic commenting —
lives on the app's **Settings** page, described below.

## Moderator actions on a post

Both actions are in the **post's ⋯ menu** and are only visible to moderators:

- **Contributors-Tracker: Review contribution** — fix a contribution that was flagged
  for review (⚠️), or correct one that was recorded wrongly. In phrase mode you set the
  contribution's proper title; in requested-by mode you set the list of `u/usernames`
  it should be credited to. You can also remove the contribution entirely. The history
  comments refresh right away.
- **Contributors-Tracker: Post contribution history** — post (or refresh) the author's
  history comment on this post. This works on *any* post by the member, tracked flair or
  not, and works even when automatic commenting is turned off — handy when you want to
  surface a member's record on demand.

## Leaderboard

The leaderboard counts each member's **tracked contributions** in your subreddit and
shows up in two places. Both are on by default and can be turned off independently on
the **Settings** page.

**Standing line in history comments.** Below the comment intro, members in the **top
half** of contributors get a line such as *"u/example is in the top 12% of our
members!"*; everyone else gets a neutral *"Contributions tracked so far: 4."* line
instead, so nobody is called out for being near the bottom. Ranking is *competition
style*: members with the same number of contributions share the same rank and the same
percentage. To avoid bragging about a near-empty ranking, the percentage wording only
appears once at least **5 members** have tracked contributions; until then everyone gets
the neutral line.

**Wiki page.** The app maintains a page at `wiki/contributors-leaderboard` (rename it on
the Settings page) listing the **top 100** members with their rank and contribution count,
tied members sharing a rank, plus a footer with the total number of members indexed and
the last update time. The page is **created with the first tracked contribution — never
at install time** — and refreshed automatically about half a minute after contributions
are added, reviewed, or removed (bursts of changes are batched into a single update).
Your subreddit's wiki must be enabled for the page to be written. Communities that
installed the app before the leaderboard existed are indexed gradually as members'
history comments refresh.

## Settings page

Open the app's **Settings** page (**Mod Tools → Installed apps → Contributors Tracker →
Settings**). Remember: this page is for *how* the app behaves and *what it says*.
**Flairs and tracking modes are not here** — they're in the subreddit mod menu under
**"Configure tracking"**.

### Behaviour

| Setting | Default | What it does |
|---|---|---|
| **Automatically post contribution-history comments** | on | When off, the app keeps tracking and keeps *existing* comments updated, but never posts a new comment on its own. Mods can still post one from the post menu. |
| **Show leaderboard standing in history comments** | on | Adds the standing line described above. |
| **Maintain the leaderboard wiki page** | on | Keeps the wiki leaderboard up to date. Turn off to stop writing to the wiki. |
| **Leaderboard wiki page name** | *contributors-leaderboard* | Wiki page path for the leaderboard. |

### Customizing the wording

The history comment ships with sensible defaults, but every community has its own
language — so the wording is yours to change. There's a field for each label:

| Setting | Default | Where it appears |
|---|---|---|
| **First table title** | *Contributions* | heading above the member's own contributions |
| **Second table title** | *Members Contributions* | heading above requested-by contributions |
| **Comment intro** | *Contributions history for* | shown before the member's username at the top |
| **Item column header** | *Contribution* | the item column in both tables |
| **Requested-by column header** | *requested by* | the credited-users column |
| **Top-half standing line** | *u/{username} is in the top {percent}% of our {members}!* | below the intro, for members in the top half |
| **Below-top-half standing line** | *Contributions tracked so far: {count}.* | below the intro, for everyone else |
| **What you call your members** | *members* | fills `{members}` in the standing lines and the wiki footer |

The standing lines support the placeholders `{username}`, `{percent}`, `{count}`,
`{total}` and `{members}` — so a baking subreddit can set the members name to *bakers*
and get *"u/example is in the top 12% of our bakers!"*.

For example, set the first table title to *Community contributions* and the intro to
*Contribution log for* to match your subreddit's voice. **Leave any field blank to keep
its default**, so you can change only the labels you care about. New wording applies the
next time a comment is posted or refreshed.

## Permissions & privacy

Contributors Tracker only works with **public post data** in your community (titles,
flairs, bodies, and authors) and stores its records in the app's own private storage.
**Only moderators** can configure tracking or review and correct contributions — regular
members can't change what the app tracks. The app requests moderator-level Reddit access
so it can read flairs, post and update the history comments, write the leaderboard wiki
page, and let mods review or correct contributions from the post menu.

## You may also like

Other Reddit apps by the same author:

### Mod tools
* [FlairAndApprove — One-click user verification: flair, approve and welcome users](https://developers.reddit.com/apps/flairandapprove)
* [Ban Extended — Ban a user and remove all of their content](https://developers.reddit.com/apps/ban-extended)
* [El Commentator — Quick comment templates for moderators](https://developers.reddit.com/apps/el-commentator)
* [Ratio Bot — Motivate users to contribute with post ratios](https://developers.reddit.com/apps/ratio-bobo)

### Community helpers
* [Community Links — Interactive link boards for your community](https://developers.reddit.com/apps/communitylinks-2)
* [Aye Aye Calendar — Display the upcoming events of your community](https://developers.reddit.com/apps/ayeayecalendar)
* [Shoppit — Interactive shopping posts with clickable product pins](https://developers.reddit.com/apps/shoppit-app)

### Games & Fun
* [MIDI Mini Music — A playable instrument inside a Reddit post](https://developers.reddit.com/apps/midi-mini-music)
