# El Commentator - Reddit Comment Template Bot

This Reddit bot helps moderators quickly post predefined comment templates on posts. 

It supports both **manual posting** and **automatic posting** based on post flairs.

## ⚠️ Important Migration Notice

**If you're updating from a previous version that used JSON string arrays in settings, you must backup your existing comment templates before updating.** The new version uses a different storage system (Redis) and will not automatically migrate your old data. You'll need to manually recreate your comment templates using the new interface.

## Features

### Manage templates
From the settings of your subreddit (three dots on top right corner), you can:
- Create, edit, delete, and view comment templates (useful to prepare for an edit)
- Priority-based comment selection (only one comment per post)
    - Flair-based comment targeting
    - Support for comments that appear on all posts
- Option to pin comments when posting

### Automatic Comment Posting
From the app settings (ModTools / Installed Apps / El Commentator), you can:
- Automatically post comments when new posts are created
- Automatically check the pin button

## Installation & Setup

1. Install the bot in your subreddit
2. Configure the bot settings:
   - **Enable Auto-commenting on Flaired Posts**: Turn on/off automatic comment posting
   - **Check Sticky Comment by default**: Set the default state for the pin comment checkbox

## Usage

### Creating Comment Templates

Access the **"El Commentator: Create Comment Template"** option from the subreddit menu.

Template fields:
- **Template Title**: A descriptive name for your template
- **Comment Text**: The actual comment content (supports markdown)
- **Associated Post Flairs**: Select which flairs should trigger this comment
- **Display on all posts**: Enable to post this comment on every new post
- **Pinned by default**: Enable to automatically pin this comment when posted

### Manual Comment Posting

1. Go to any post in your subreddit
2. Select **"El Commentator: Post Predefined Comment"** from the post menu
3. Choose your comment template
4. Optionally check "Sticky comment" to pin it
5. Click "Add comment"

### Automatic Comment Priority System

When a new post is created, the bot selects **only one comment** to post based on this priority order:

1. **Highest Priority**: Comments with exactly 1 flair matching the post's flair
2. **Medium Priority**: Comments with multiple flairs that include the post's flair  
3. **Lowest Priority**: Comments set to "Display on all posts"

This ensures the most specific and relevant comment is posted for each situation.

### Template Management

- **Edit Templates**: Modify existing templates via "El Commentator: Edit Comment Template"
- **Delete Templates**: Remove templates via "El Commentator: Delete Comment Template"
- **View All Templates**: See all your templates and their settings via "El Commentator: View All Templates"

## Supported Features

- **Markdown Support**: Use standard Reddit markdown in your comments
- **Links**: Standard markdown links `[text](url)` are supported
- **Auto-Pinning**: Comments can be automatically pinned when posted
- **Flair Integration**: Full integration with your subreddit's post flair system

## Troubleshooting

- **No templates showing**: Create templates first using "Create Comment Template"
- **Auto-comments not working**: Check that "Enable Auto-commenting" is turned on in settings
- **Flair not recognized**: Verify the flair exists in your subreddit's flair templates