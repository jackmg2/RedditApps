# 🥁 Rebbeat

**A drum machine that lives right inside your subreddit.**

## 🎛️ What is it?

Rebbeat turns a Reddit post into a step sequencer. Members tap cells on a grid to
program a beat, press play to hear it loop, and share it under the post as a comment.
Each shared beat comes with a short text code, so anyone can load it with one paste,
then change it and share their own version.

No samples, no downloads and no music experience needed. Every sound is synthesized
live in the browser.

## 💡 Why add it to your community

- **Instant fun**: a demo beat is ready the moment the post opens. Tap a cell and you
  are already making music.
- **Boosts engagement**: beats shared as comments get replies, remixes and friendly
  "beat battles".
- **Works everywhere**: desktop, mobile web and the Reddit app, with touch, mouse or
  keyboard.
- **Safe by design**: a shared comment can only hold a validated beat code and a short
  plain-text message.

## 🥁 What your members can do

- **Program a beat** on a 16-step grid, or switch to **32 steps** for longer patterns.
- **Pick from 16 instruments**: kick, snare, clap, rimshot, closed and open hi-hats,
  crash, ride, three toms, cowbell, shaker, clave, a bass pluck and a blip. A beat can
  have up to 8 tracks.
- **Set the tempo** from 40 to 240 BPM. Tap the number to type a value, or hold − / +.
- **Mute, preview, reorder or remove** a track from its icon.
- **Undo / redo** any edit.
- **Share** a beat as a comment, or copy its code to paste anywhere.
- **Load** any beat code from a comment and keep jamming.

Unfinished beats are saved on the member's device, so closing the post by accident does
not lose their work.

## 🛠️ How to install (for moderators)

1. Add **Rebbeat** to your subreddit from the Reddit community apps directory.
2. Open your subreddit and use the moderator menu action **"Create a new Rebbeat post"**.
3. Choose a title. Your drum machine post appears in the feed, ready for the community.

**Use your own beat as the default.** By default a post opens on a short demo beat.
To replace it, paste a beat code in the optional **Starting beat code** field when you
create the post. You can also open the post, program a beat and pick **⋯ → Set as this
post's default beat**. New visitors then start from your beat. **Reset default to the
demo beat** brings the demo back. Only moderators with the **Manage Posts & Comments**
permission see these options. Members who already have a saved draft keep it, and
they can pick **⋯ → Start over from the default beat** to load yours.

If a moderator removes a Rebbeat post or a shared-beat comment, the app deletes it on
its side too. Removing a Rebbeat post also deletes any comments the app account posted
under it.

## 👆 How to play (for members)

1. Open a Rebbeat post and tap **🥁 Start the beat!**
2. Tap cells to turn steps on or off, then press **▶** to listen. The highlighted column
   shows the step that is playing.
3. Tap **+** to add an instrument, or tap a track icon for its options.
4. Press **Share** to post your beat as a comment or copy its code. Press **Load** to
   paste a code from someone else.

**Keyboard shortcuts**

- `Space`: play / stop
- `Ctrl/Cmd + Z`: undo. `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y`: redo
- Arrow keys move around the grid, and `Enter` / `Space` toggles a step

**Beat codes** look like this:

```
BB1;120;16;kick:8888;snare:0808;hhc:aaaa
```

That is the format tag, the tempo, the number of steps, then one `instrument:pattern`
pair per track.

## 🙏 Privacy

* Nothing is stored about members. The only server-side record is a 30-second
  anti-spam timer per member, plus the list of beats shared in each post.
* A member's username appears only in the public comment they choose to post in their name. They can delete it.
* A shared comment can only contain a validated beat code and a 200-character
  plain-text message. Everyone can report it like any other comment.

## You may also like

Other Reddit apps by the same author:

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

