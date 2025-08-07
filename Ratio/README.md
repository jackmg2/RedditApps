# Ratio! Bobobo! Motivate your users to contribute on some specific flair.

## ⚡️ What It Does

Ratio-bobo is a bot to balance posts from your users. It supports two modes:

### Normal Mode (Default)
In the App settings, you can define the number of posts allowed that are not a post with a specific flair.

For example, you have an open-source project, you want to motivate people to create Documentation posts. In Settings, you can set the `Ratio` value at 2 and the `Tracked post flair` on "Documentation". That means your users will need to write a Documentation post for each 2 questions posts they will create.

### Inverted Mode (New!)
Enable "Inverted Ratio Mode" to limit how often users can post with specific flairs. This is useful for restricting certain types of posts.

For example, you want users to contribute regular content before asking questions. Set `Ratio` to 3 and track "Question" flair. Users must make 3 regular posts before they can post 1 question.

**In inverted mode:**
- The ratio display in user flairs shows regular posts on the left, monitored posts on the right
- Users earn the right to post with monitored flairs by contributing regular content first

## 🎮 How it works?
Most of the work is done automatically! 🤖

You can do several quick actions from community menu:
* Manually set user ratio: You can fix the ratio manually for the current user
* Refresh Wiki: Manually update the wiki page with the latest ratio records

Or directly from a post:
* Change flair and update ratio: If the user picked up the wrong flair, you can change it. The ratio will be updated automatically.
* Remove flair: Quickly remove a post's flair and update the user's ratio in one click
* Set User Ratio by Username: Set the ratio for any user by entering their username

## 🧮 Automatic Ratio Management
The app automatically manages ratios for common actions:
* When a user submits a post that violates the ratio, it's removed WITHOUT affecting their ratio
* When a user deletes their own post, their ratio is automatically adjusted
* All changes to ratios are recorded in a wiki page for transparency

## ⚙️ Settings to be even faster
* **Inverted Ratio Mode**: Toggle between normal and inverted ratio enforcement
* Set the expected ratio: x posts for each tracked flair (or x posts required per tracked flair in inverted mode)
* Set the flairs you want to track. You can separate them with semicolons, for example: "Documentation;Fix" or "Question;Help"
* Comment for ratio violation to explain why a post has been removed
* Comment for wrong flair, to explain that it was not the expected flair

## 🆕 Last update
* **NEW: Inverted Ratio Mode** - Limit how often users can post with specific flairs
* Posts removed due to ratio violations no longer affect the user's ratio
* User ratio is automatically updated when they delete their posts
* New subreddit menu item to set any user's ratio by username
* You can now remove and update a flair in one click!

## Next update
* [ ] Fix order in wiki page (order by date and time)
* [ ] Fix error toast message that shouldn't be displayed (it's working)

## 🍴 Fork me on Github
[You want to contribute? | You found Bugs?](https://github.com/jackmg2/RedditApps)

*Built by mods, for mods 🛡️*# Ratio! Bobobo! Motivate your users to contribute on some specific flair.

## ⚡️ What It Does

Ratio-bobo is a bot to balance posts from your users. It supports two modes:

### Normal Mode (Default)
In the App settings, you can define the number of posts allowed that are not a post with a specific flair.

For example, you have an open-source project, you want to motivate people to create Documentation posts. In Settings, you can set the `Ratio` value at 2 and the `Tracked post flair` on "Documentation". That means your users will need to write a Documentation post for each 2 questions posts they will create.

### Inverted Mode (New!)
Enable "Inverted Ratio Mode" to limit how often users can post with specific flairs. This is useful for restricting certain types of posts.

For example, you want users to contribute regular content before asking questions. Set `Ratio` to 3 and track "Question" flair. Users must make 3 regular posts before they can post 1 question.

**In inverted mode:**
- The ratio display in user flairs shows regular posts on the left, monitored posts on the right
- Users earn the right to post with monitored flairs by contributing regular content first

## 🎮 How it works?
Most of the work is done automatically! 🤖

You can do several quick actions from community menu:
* Manually set user ratio: You can fix the ratio manually for the current user
* Refresh Wiki: Manually update the wiki page with the latest ratio records

Or directly from a post:
* Change flair and update ratio: If the user picked up the wrong flair, you can change it. The ratio will be updated automatically.
* Remove flair: Quickly remove a post's flair and update the user's ratio in one click
* Set User Ratio by Username: Set the ratio for any user by entering their username

## 🧮 Automatic Ratio Management
The app automatically manages ratios for common actions:
* When a user submits a post that violates the ratio, it's removed WITHOUT affecting their ratio
* When a user deletes their own post, their ratio is automatically adjusted
* All changes to ratios are recorded in a wiki page for transparency

## ⚙️ Settings to be even faster
* **Inverted Ratio Mode**: Toggle between normal and inverted ratio enforcement
* Set the expected ratio: x posts for each tracked flair (or x posts required per tracked flair in inverted mode)
* Set the flairs you want to track. You can separate them with semicolons, for example: "Documentation;Fix" or "Question;Help"
* Comment for ratio violation to explain why a post has been removed
* Comment for wrong flair, to explain that it was not the expected flair

## 🆕 Last update
* **NEW: Inverted Ratio Mode** - Limit how often users can post with specific flairs
* Posts removed due to ratio violations no longer affect the user's ratio
* User ratio is automatically updated when they delete their posts
* New subreddit menu item to set any user's ratio by username
* You can now remove and update a flair in one click!

## Next update
* [ ] Fix order in wiki page (order by date and time)
* [ ] Fix error toast message that shouldn't be displayed (it's working)

## 🍴 Fork me on Github
[You want to contribute? | You found Bugs?](https://github.com/jackmg2/RedditApps)

*Built by mods, for mods 🛡️*