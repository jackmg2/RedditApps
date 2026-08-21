# El Commentator: Quick Comment Templates

## ⚡️ What It Does
Never type the same moderation comment twice! El Commentator helps you post predefined comment templates instantly, whether manually or automatically based on post flairs.

* 🆕 **Schedule campaigns with an optional active period** — start/end as a date or date + time (UTC) 📅
* Quick comment templates 💬
* Auto-comment on flairs 🏷️
* Auto-comment for specific users 👽
* Multiple comments per user (randomly selected) 🎲
* Pin comments automatically 📌
* Priority-based selection 🎯
* Enable/disable templates without deleting them ✅
* Manage everything from one unified hub 🗂️
* Markdown support ✨

## 🎮 How it works?
### Manage your comment templates
* From your subreddit, click the three dots next to mod tools
* Hit "El Commentator: Manage Comment Templates"
* Choose an action: **Create new comment**, **Edit existing one**, or **Remove existing one** (edit/remove only appear once you have templates)

#### Create new comment
* Write a title and the comment content
* Optionally choose target flairs (multi-select), or leave empty to display on all posts
* Optionally enter a username to make it a user-based template instead
* **Note**: A template can target either flairs or a username, not both
* Check "Pinned by default" if needed
* Optionally set an active period with **Active from** and/or **Active until** — perfect for planning campaigns. Use `YYYY-MM-DD` (e.g. `2026-08-20`) or `YYYY-MM-DD HH:MM` in 24-hour UTC (e.g. `2026-08-20 14:30`); both bounds are inclusive. A date without a time means from 00:00 UTC / through 23:59 UTC of that day. Leave a field empty for no bound on that side; leave both empty and the template is always active

#### Edit existing one
* Pick a template from the list (shown as `[Flair]` or `[User]`)
* Update title, content, flairs/username, or pinned setting
* Toggle **Enabled** off to temporarily exclude it from automatic posting without deleting it
* Add, change, or clear the **Active from** / **Active until** bounds (`YYYY-MM-DD` or `YYYY-MM-DD HH:MM`, UTC) to reschedule a campaign (blank both fields to make the template always active)
* Switching between an empty and filled username converts the template between flair-based and user-based
* **Note**: You can create multiple different comment templates for the same user - one will be randomly selected when triggered

#### Remove existing one
* Select one or more templates from the list (`[Flair]`/`[User]`)
* Confirm to delete them all at once

### Manual posting
* Click mod tools under any post
* Hit "El Commentator: Post Predefined Comment"
* Choose your template
* Check "Sticky comment" if needed

### Automatic posting
* Comments post automatically when matching posts are created
* Priority system ensures the most relevant comment is selected
* Templates with **Enabled** turned off are skipped entirely
* Templates outside their active period are skipped too — they show as `[Scheduled from …]` or `[Expired …]` in the template lists, but can still be posted manually
* For users with multiple comment templates, one is randomly chosen

## ⚙️ Settings to be even faster
* Set default pin (sticky) behavior for manual and automatic posting
* Manage all templates from the "El Commentator: Manage Comment Templates" hub

## 🎯 Priority System
If two comments should be displayed and one is a comment for a user, they are going to be merged.

When multiple templates match a post, only one comment is posted based on priority:
1. **Highest**: Templates with exactly 1 matching flair
2. **Medium**: Templates with multiple flairs including the post's flair
3. **Lowest**: Templates set to "Display on all posts"

If several templates match at the same level, those with an active period set take priority over always-active ones — handy for running a temporary campaign on top of an evergreen default. Among equals, one is chosen at random.

Templates with **Enabled** turned off, or outside their active period, are excluded from this selection entirely.

**User-based comments**: If multiple comment templates exist for the same user, one is randomly selected each time they post.

## 🍴 Fork me on Github
[Get Started | Find Bugs? | Level Up the Tool](https://github.com/jackmg2/RedditApps)

*Built by mods, for mods 🛡️*

## You may also like

Other Reddit apps by the same author:

### Mod tools
* [FlairAndApprove — One-click user verification: flair, approve and welcome users](https://developers.reddit.com/apps/flairandapprove)
* [Ban Extended — Ban a user and remove all of their content](https://developers.reddit.com/apps/ban-extended)
* [Contributors Tracker — Track your best contributors](https://developers.reddit.com/apps/contributorstracker)
* [Ratio Bot — Motivate users to contribute with post ratios](https://developers.reddit.com/apps/ratio-bobo)

### Community helpers
* [Community Links — Interactive link boards for your community](https://developers.reddit.com/apps/communitylinks-2)
* [Aye Aye Calendar — Display the upcoming events of your community](https://developers.reddit.com/apps/ayeayecalendar)
* [Shoppit — Interactive shopping posts with clickable product pins](https://developers.reddit.com/apps/shoppit-app)

### Games & Fun
* [MIDI Mini Music — A playable instrument inside a Reddit post](https://developers.reddit.com/apps/midi-mini-music)
