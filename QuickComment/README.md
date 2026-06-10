# El Commentator: Quick Comment Templates

## ⚡️ What It Does
Never type the same moderation comment twice! El Commentator helps you post predefined comment templates instantly, whether manually or automatically based on post flairs.

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

#### Edit existing one
* Pick a template from the list (shown as `[Flair]` or `[User]`)
* Update title, content, flairs/username, or pinned setting
* Toggle **Enabled** off to temporarily exclude it from automatic posting without deleting it
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

Templates with **Enabled** turned off are excluded from this selection entirely.

**User-based comments**: If multiple comment templates exist for the same user, one is randomly selected each time they post.

## 🍴 Fork me on Github
[Get Started | Find Bugs? | Level Up the Tool](https://github.com/jackmg2/RedditApps)

*Built by mods, for mods 🛡️*