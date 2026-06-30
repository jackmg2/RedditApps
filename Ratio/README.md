# Ratio Bot - Balance Your Community Posts

*Built by mods, for mods 🛡️*

## ⚡️ What It Does

Ratio Bot keeps your community in balance. For each user it counts two kinds of posts:

- **Regular posts** – casual posts.
- **Special posts** – posts with one of the flairs you choose to track (for example "Question", "Self-Promo", or "Meme").

You pick a ratio, and the bot makes sure **each user keeps their regular and special posts in that proportion**. 

A user's running count is shown right in their user flair as `[regular/monitored]`, and **posts that would break the ratio are removed automatically.**

## 🔄 The Two Modes

Use Normal Mode to stop one *type* of post from flooding the feed, and Inverted Mode to make a privileged post type something users have to *earn*.

### Normal Mode (default)
Users can make **X regular posts for every 1 special post**.

**Example:** Ratio set to 3, with the "Feedback" flair tracked. A user can post 3 regular posts for each "Feedback" they give. More regular posts without giving feedback get removed.

### Inverted Mode
Users must make **X regular posts to earn 1 special post**.

**Example:** Ratio set to 3, with the "Self-Promo" flair tracked. A user must make 3 regular posts before they're allowed 1 self-promo post.


## 🎟️ Starting Credit (free allowance)

Every user begins with a little headroom so they aren't blocked on their very first special post. That headroom is the **Starting credit** setting (default: **1**).

- **Normal mode:** allowed regular posts = ratio × (special posts + credit).
- **Inverted mode:** allowed special posts = (regular posts ÷ ratio, rounded down) + credit.

**Example (Normal mode, ratio 3, credit 1):** a brand-new user with 0 special posts can still make up to 3 regular posts before anything is enforced (3 × (0 + 1)). Posting a special post raises that allowance.

Set credit to **0** for strict enforcement from the very first post.

## 🏷️ What Users See

The bot appends a tag to each user's flair showing their current counts:

`[Regular Posts/Monitored Posts]` — for example `[6/2]` means 6 regular posts and 2 special posts.

- The tag is **always** shown as `[regular/monitored]`, in that order, in both modes.
- **Exempt users** never get a tag and are never enforced (see settings below).

## 🤖 What Happens Automatically

- **Ratio violations:** A post that would break the ratio is removed — but it **does not** count against the user, so they're never "punished twice". An optional comment explains why.
- **Deleted posts:** When a user (or mod) deletes a post, the bot adjusts that user's count. You control whether deletions reduce the regular and/or special counts (see the two deletion settings). It's interesting to avoid smart people removing their post on a regular basis.
- **Flair changes:** Re-flairing a post moves it between *regular* and *special* and updates the user's counts accordingly. If a special post is corrected back to regular, the bot can post a note explaining it.

## 💬 Comments the Bot Can Post

Three optional messages, all configurable. Leave a message blank to turn it off.

| Comment | When it's posted |
|---|---|
| **Ratio violation comment** | When the bot removes a post for breaking the ratio. |
| **Wrong-flair comment** | When a special post is re-flaired back to a regular post. |
| **Credit-earned comment** | When a post increases a user's allowance (a special post in Normal mode; a regular post that unlocks a new special slot in Inverted mode). There's also an on/off switch so you can keep your saved message but stop posting it. |

### Personalize your comments with placeholders

Drop any of these into a comment and the bot fills in the real values:

| Placeholder | Becomes |
|---|---|
| `{{username}}` | The user's name |
| `{{regular}}` | Their current regular post count |
| `{{monitored}}` | Their current special post count |
| `{{ratio}}` | Your configured ratio number |
| `{{balance}}` | Their counts together, e.g. `6/2` |
| `{{remaining}}` | How many more of the limited post type they can still make right now |

**Example:** `Hi {{username}}, you've hit your limit. You can post again after {{remaining}} more regular posts.`

## 🧰 Moderator Tools

Find these in the **"..." menus** in Reddit.

**On a post:**
- **Ratio: Manually set user ratio** – Directly edit the post author's regular/special counts. Use this when you need to correct someone's numbers.
- **Ratio: Change flair and update ratio** – Change a post's flair and re-classify the author's counts in one step. Use this when a post was flaired wrong.
- **Ratio: Remove flair** – Strip a post's flair and re-classify the author's counts. Use this to turn a special post back into a regular one.

**On the subreddit (from any page in your sub):**
- **Ratio: Set User Ratio by Username** – Set any user's counts by typing their username — no need to find one of their posts.
- **Ratio: Refresh Wiki** – Rebuild the history wiki on demand (see below).

## 📚 History Wiki

The bot keeps a private, **mods-only** record of every ratio change in your subreddit's wiki — your members can't see it.

- A main page (**`redditratio`**) acts as an index with links to **one page per month**.
- Each monthly page lists that month's events, grouped by user, newest first.

Splitting history by month keeps each page fast and well under Reddit's page-size limit, so your full history is preserved over time. Use **Refresh Wiki** any time you want to rebuild it from scratch.

## ⚙️ Setup & Configuration

### Required
1. **Ratio value** – The ratio number (e.g. `3` means 3:1).
2. **Tracked post flair** – The flair(s) to treat as "special". Add multiple by separating them with semicolons: `Question;Help;Bug Report`.
3. **Comment for ratio violation** – The message posted when a post is removed for breaking the ratio.

### Optional
- **Inverted Ratio Mode** – Switch between Normal and Inverted (off by default).
- **Starting credit** – The free allowance every user starts with (default `1`; set `0` for strict enforcement).
- **Exempt usernames** – Users who bypass all ratio rules and get no flair tag. Separate with semicolons: `AutoModerator;helpful_bot`.
- **Decrease monitored post count on removal** – Whether removing a special post lowers that user's special count (on by default).
- **Decrease regular post count on removal** – Whether removing a regular post lowers that user's regular count (on by default).
- **Comment after modifying a wrong flair** – Message posted when a special post is corrected back to regular (blank = off).
- **Post the credit-earned comment** – On/off switch for the credit-earned message.
- **Comment when a post earns credit** – The credit-earned message itself (blank = off).

## 🚀 Quick Start

1. **Install** Ratio Bot in your subreddit.
2. **Configure** the settings above for your community.
3. **Let it run** – the bot tracks posts and enforces the ratio automatically.
4. **Use the moderator tools** when you need to make a manual adjustment.
5. **Check the history wiki** to see what's been happening.

## 🔧 Pro Tips

- **Start with a higher ratio** (4:1 or 5:1) and tighten it as you learn your community's habits.
- **Exempt your mods and trusted bots** so they're never enforced or tagged.
- **Use `{{remaining}}` in your violation comment** so users know exactly what to do next.
- **Inverted mode is great** for making low-effort or self-promo posts something users have to earn.
- **Set Starting credit to 0** if you want the ratio enforced from a user's very first post.