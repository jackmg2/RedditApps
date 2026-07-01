# Contributors Tracker

**Automatically track and showcase community contributions on your subreddit.**

Contributors Tracker watches the posts in your community and keeps a running record of
who contributes what. When someone makes a tracked post, the app replies with a tidy,
auto-updating history of everything that member has contributed — so recognition,
track records, and accountability are always one click away.

It runs quietly in the background. Once you tell it which post flairs to track, there is
nothing else to manage.

## What it does

- **Tracks contributions by flair.** You choose which post flairs count as contributions.
  Every matching post is recorded automatically.
- **Builds a per-member history.** On each tracked post, the app leaves (and keeps
  updated) a comment with a clean table of that member's contributions in your subreddit.
- **Stays accurate over time.** Edits, flair changes, and deletions are handled
  automatically, so the history always reflects reality.

## Why moderators love it

- 🏆 **Recognize and reward** your most active contributors with a visible track record.
- 👀 **Vet at a glance.** See a member's full contribution history right on their post —
  no digging through profiles or spreadsheets.
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
- **Optimistic tracking** — the flair is what counts. A tracked post is always recorded;
  if its title matches no phrase or has no username, it's flagged for review (⚠️) right
  in the history comment so a moderator can finish it — nothing is silently dropped.
- **Auto-updating history tables** — each contributor's comment refreshes as they post,
  showing their most recent contributions with older entries summarized.
- **Moderator review** — a **"Review contribution"** post menu lets mods set the proper
  title (phrase mode) or the requested-by usernames (requested-by mode), or remove a
  contribution — all straight from the post.
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
   one is already there.
4. **It keeps everything in sync** as posts are edited, re-flaired, reviewed from the
   post menu, or removed.

## Getting started

1. **Install** Contributors Tracker on your subreddit (you'll need moderator access).
2. Open your subreddit's **moderator menu** and choose **"Configure tracking."**
3. **Pick the flairs** you want to track and a **tracking mode** (phrase matching or
   requested-by). In phrase mode, optionally list the title phrases to match.
4. **Save** — that's it. The app starts tracking new posts immediately and quietly
   backfills existing contributors over time.

You can reopen **"Configure tracking"** anytime to add flairs, change a mode, or stop
tracking a flair.

## Customizing the wording

The history comment ships with sensible defaults, but every community has its own
language — so the wording is yours to change. Open the app's **settings screen**
(Reddit **mod tools → installed apps →** Contributors Tracker → *Settings*; this is
separate from the **"Configure tracking"** menu that handles flairs and modes) and you'll
find a field for each label:

| Setting | Default | Where it appears |
|---|---|---|
| **First table title** | *Contributions* | heading above the member's own contributions |
| **Second table title** | *Members Contributions* | heading above requested-by contributions |
| **Comment intro** | *Contributions history for* | shown before the member's username at the top |
| **Item column header** | *Contribution* | the item column in both tables |
| **Requested-by column header** | *requested by* | the credited-users column |

For example, set the first table title to *Community contributions* and the intro to
*Contribution log for* to match your subreddit's voice. **Leave any field blank to keep
its default**, so you can change only the labels you care about. New wording applies the
next time a comment is posted or refreshed.

## Permissions & privacy

Contributors Tracker only works with **public post data** in your community (titles,
flairs, bodies, and authors) and stores its records in the app's own private storage.
**Only moderators** can configure tracking or review and correct contributions — regular
members can't change what the app tracks. The app requests moderator-level Reddit access
so it can read flairs, post and update the history comments, and let mods review or
correct contributions from the post menu.
