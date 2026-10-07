# Ban extended: Ban user and remove all of their content.

## ⚡️ What It Does

We all have to manage some flood campaign. It can be tedious to remove each comment by ourselves. This extension is there to help you nuke an user and all of his content!

## 🆕 What's new?
* Default ban message and mod note! Set them once in the app settings and they pre-fill every ban form. Use `{rule}` for the broken rule and `{ruleMessage}` for its removal reason text, so one template gives you a different message per rule.
* Mod note field in all ban forms (ban, shadowban, bulk). Mods see it in the ban list; the user never does.
* Hide the message or the note field from the settings: the default is then applied silently.
* The ban reason shown in your ban list is now the rule title instead of a truncated removal reason text.
* Shadowban! Keep a user unbanned on Reddit's side while the app silently removes everything they post or comment in your community. A mod note "Shadowbanned: [rule] - [note] (date)" is added to the user so your team knows.
* Undo Ban also lifts shadowbans and restores the content removed while the user was shadowbanned.
* Mute from modmail! Tick "Mute user from modmail" in any ban form to stop the user from sending modmail for 28 days. Like the lock option, it can be pre-checked or hidden from the app settings.
* Undo Ban! Unban a user and restore what the app removed or locked when they were banned, and unmute them if the app muted them.
* Lock all of a user's existing posts, on single and bulk bans instead of removing his contributions.
* Hide the lock option from the ban forms via a new setting. Hidden means deactivated, whatever the default.
* Bulk ban now accepts commas or semicolons between usernames.
* Safer permission checks: banning requires the "Manage Users" mod permission; removing or locking content also requires "Manage Posts & Comments".

## 🎮 How it works?
### Ban & Remove
* Click mod tools
* Hit "Ban User and Remove Content"
* Fill the ban form as usual
* Choose if you want to remove all content or just the previous days
* Optionally check "Lock all user's existing posts" to lock every post they made in your community
* Optionally check "Mute user from modmail" so the user can't send modmail to your community for 28 days (Reddit's maximum)
* BAM!

Tip: in the app settings you can set default values for the ban duration, the content removal period, and whether the lock and mute options are pre-checked. You can also hide the lock or mute option entirely: when hidden, the action never happens, even if its "by default" setting is on.

### Default ban message and mod note
* In the app settings, write a "Default ban message" (sent to the banned user) and a "Default mod note" (seen by moderators only, in the ban list)
* Both come with a ready-to-use template: a polite ban notice naming the broken rule for the message, and `{rule} - {ruleMessage}` for the mod note. Edit or clear them in the app settings
* Both accept two placeholders, replaced when the form is submitted: `{rule}` becomes the title of the rule selected in "Rule Violated", and `{ruleMessage}` becomes the text of that removal reason, as written in your subreddit's removal reasons
* Example message: `You have been banned for breaking {rule}. {ruleMessage}`
* The templates pre-fill the form fields, so you can still edit them before each ban
* Tick off "Show the ban message field" or "Show the mod note field" to remove the field from the forms: the default template is then applied as is (nothing is sent if it is empty)

### Shadowban & Remove
* Click mod tools
* Hit "Shadowban User and Remove Content"
* Fill the same form as for a ban: duration, rule, mod note, content removal, lock and mute options (note that Reddit notifies muted users, which can reveal the shadowban). There is no ban message field, since the user is never notified
* The user is NOT banned and NOT notified. Instead, every post and comment they submit from now on is removed automatically (as spam if you ticked "Mark as spam"), until the duration runs out or you undo it
* A mod note is added to the user: "Shadowbanned: [rule] - [note] (YYYY-MM-DD)"

Because the app does the removing, shadowbanning requires both the "Manage Users" and "Manage Posts & Comments" mod permissions. The user's post or comment exists for a moment before the app removes it, and a shadowban does not appear in Reddit's ban list, so check the mod notes if you wonder why a user's content keeps vanishing.

### Export banned list
* From the community menu settings
* Click on "Ban Extended: Export Banned Users"
* And copy the list of your banned users

### Bulk ban
* From the community menu settings
* Click on "Ban Extended: Bulk Ban Users"
* And paste the list of users to ban, separated by commas or semicolons (e.g., user1;user2 or user1,user2)

Great to synchronize ban users between communities!

### Undo Ban
* From the community menu settings
* Click on "Ban Extended: Undo Ban"
* Type the username (with or without the u/ prefix)
* Choose whether to re-approve the content the app removed, unlock the posts it locked and unmute the user if the app muted them
* The user is unbanned and their content comes back!
* Works for shadowbanned users too: the shadowban is lifted and the content removed while it was active can be re-approved

Only content removed or locked by this app can be restored, and restore data is kept for 90 days after the ban. Older bans can still be undone — the user is unbanned, just without content restoration.


*Built by mods, for mods 🛡️*

## You may also like

Other Reddit apps by the same author:

### Mod tools
* [FlairAndApprove — One-click user verification: flair, approve and welcome users](https://developers.reddit.com/apps/flairandapprove)
* [El Commentator — Quick comment templates for moderators](https://developers.reddit.com/apps/el-commentator)
* [Contributors Tracker — Track your best contributors](https://developers.reddit.com/apps/contributorstracker)
* [Ratio Bot — Motivate users to contribute with post ratios](https://developers.reddit.com/apps/ratio-bobo)

### Community helpers
* [Community Links — Interactive link boards for your community](https://developers.reddit.com/apps/communitylinks-2)
* [Aye Aye Calendar — Display the upcoming events of your community](https://developers.reddit.com/apps/ayeayecalendar)
* [Shoppit — Interactive shopping posts with clickable product pins](https://developers.reddit.com/apps/shoppit-app)

### Games & Fun
* [MIDI Mini Music — A playable instrument inside a Reddit post](https://developers.reddit.com/apps/midi-mini-music)
