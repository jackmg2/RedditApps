# Ratio Bot - Balance Your Community Posts

*Built by mods, for mods 🛡️*

## ⚡️ What It Does

Ratio Bot helps you balance posts in your community by tracking user ratios between regular posts and special flaired posts. Choose between two enforcement modes:

### 🔄 Normal Mode (Default)
Users can make X regular posts for every 1 special post.

**Example:** Set ratio to 3 with "Question" flair tracked. Users can ask 1 question for every 3 regular posts they make.

### 🔀 Inverted Mode 
Users must make X regular posts to earn 1 special post.

**Example:** Set ratio to 3 with "Question" flair tracked. Users must make 3 regular posts before they can ask 1 question.

## 🎯 Key Features

### Automatic Enforcement
- **Smart violation handling:** Posts that violate ratios are removed but don't count against the user
- **Post deletion tracking:** When users delete posts, their ratios adjust automatically  
- **Real-time ratio display:** User flairs show current ratio as [regular/monitored]

### Moderator Controls
**Post Menu Actions:**
- **Change flair and update ratio** - Fix wrong flairs and update ratios in one click
- **Remove flair** - Strip flair and adjust ratio
- **Manually set user ratio** - Direct ratio modification

**Subreddit Menu Actions:**
- **Set ratio by username** - Adjust any user's ratio
- **Refresh wiki** - Update the tracking wiki page

### Advanced Options
- **Exempt users** - Bypass ratio rules for specific users (mods, bots, etc.)
- **Flexible deletion settings** - Choose whether deletions affect regular/monitored counts
- **Wiki tracking** - Automatic record keeping of all ratio changes

## ⚙️ Setup & Configuration

### Required Settings
1. **Ratio Value** - The ratio number (e.g., 3 = 3:1 ratio)
2. **Tracked Flairs** - Flairs to monitor (separate multiple with semicolons: "Question;Help;Bug Report")
3. **Violation Comment** - Message posted when removing violating posts

### Optional Settings
- **Inverted Ratio Mode** - Toggle enforcement mode
- **Exempt Users** - Usernames to bypass (separate with semicolons: "AutoModerator;bot_name")
- **Deletion Behavior** - Whether deletions decrease counts
- **Wrong Flair Comment** - Message when correcting flairs

## 🚀 How It Works

1. **Install the app** in your subreddit
2. **Configure settings** based on your community needs
3. **Let it run automatically** - users get notified of violations
4. **Use moderator tools** as needed for manual adjustments
5. **Check the wiki** for complete tracking history

## 📊 Understanding Ratios

**User flair format:** `[Regular Posts/Monitored Posts]`
- Normal mode: [6/2] means 6 regular, 2 special posts (3:1 ratio maintained)
- Inverted mode: [6/2] means user earned 2 special posts by making 6 regular posts

**Color coding in your head:**
- Green: User is within ratio limits
- Red: User would violate ratio (post gets removed)

## 🔧 Pro Tips

- **Start with higher ratios** (4:1 or 5:1) and adjust based on community behavior
- **Use exempt users** for moderators and helpful community members  
- **Check the wiki regularly** to monitor community patterns
- **Inverted mode works great** for limiting help requests or low-effort posts

## 🆕 Latest Features
- **Inverted ratio mode** for limiting special post types
- **Exempt users system** for bypassing ratio rules
- **Smart violation handling** - removed posts don't affect ratios
- **Improved deletion tracking** with configurable behavior
- **Enhanced moderator tools** for easier management

## 🍴 Issues or Features?
[Report bugs or request features on GitHub](https://github.com/jackmg2/RedditApps)