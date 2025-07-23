import { Devvit, JSONObject, FormOnSubmitEvent, TriggerContext } from '@devvit/public-api';

type Comment = {
  id: string;
  title: string;
  comment: string;
  flairs: string[]; // Array of flair IDs that should trigger this comment
  displayOnAllPosts: boolean; // New field for displaying on all posts
  pinnedByDefault: boolean; // New field for pinning comments by default
}

type UserComment = {
  id: string;
  title: string;
  comment: string;
  username: string; // Username (without u/ prefix)
  pinnedByDefault: boolean;
}

type PostFlair = {
  id: string;
  text: string;
}

Devvit.configure({ redditAPI: true, http: false });

// Add settings for backward compatibility and configuration
Devvit.addSettings([
  {
    name: 'autoCommentEnabled',
    label: 'Enable Auto-commenting on Flaired Posts',
    type: 'boolean',
    helpText: 'Automatically post predefined comments when posts are created with matching flairs.',
  },
  {
    name: 'defaultValuePinComment',
    label: 'Check Sticky Comment by default',
    type: 'boolean',
  },
]);

// Storage keys
const COMMENTS_KEY = 'predefined_comments';
const USER_COMMENTS_KEY = 'user_comments';
const NEXT_ID_KEY = 'next_comment_id';
const NEXT_USER_ID_KEY = 'next_user_comment_id';

// Helper functions for data management
async function getStoredComments(context: TriggerContext): Promise<Comment[]> {
  const stored = await context.redis.get(COMMENTS_KEY);
  return stored ? JSON.parse(stored) : [];
}

async function getStoredUserComments(context: TriggerContext): Promise<UserComment[]> {
  const stored = await context.redis.get(USER_COMMENTS_KEY);
  return stored ? JSON.parse(stored) : [];
}

async function saveComments(context: Devvit.Context, comments: Comment[]): Promise<void> {
  await context.redis.set(COMMENTS_KEY, JSON.stringify(comments));
}

async function saveUserComments(context: Devvit.Context, userComments: UserComment[]): Promise<void> {
  await context.redis.set(USER_COMMENTS_KEY, JSON.stringify(userComments));
}

async function getNextId(context: Devvit.Context): Promise<string> {
  const current = await context.redis.get(NEXT_ID_KEY);
  const nextId = current ? parseInt(current) + 1 : 1;
  await context.redis.set(NEXT_ID_KEY, nextId.toString());
  return nextId.toString();
}

async function getNextUserId(context: Devvit.Context): Promise<string> {
  const current = await context.redis.get(NEXT_USER_ID_KEY);
  const nextId = current ? parseInt(current) + 1 : 1;
  await context.redis.set(NEXT_USER_ID_KEY, nextId.toString());
  return nextId.toString();
}

async function getSubredditFlairs(context: Devvit.Context): Promise<PostFlair[]> {
  try {
    const subreddit = await context.reddit.getCurrentSubreddit();
    const flairs = await context.reddit.getPostFlairTemplates(subreddit.name);
    return flairs.map(f => ({ id: f.id, text: f.text || 'No text' }));
  } catch (error) {
    console.error('Error fetching flairs:', error);
    return [];
  }
}

// Helper function to format all comments for viewing
async function formatAllComments(context: Devvit.Context): Promise<string> {
  const comments = await getStoredComments(context);
  const userComments = await getStoredUserComments(context);
  const flairs = await getSubredditFlairs(context);

  if (comments.length === 0 && userComments.length === 0) {
    return "No comment templates found.";
  }

  // Create a map of flair IDs to flair text for display
  const flairMap = new Map(flairs.map(f => [f.id, f.text]));

  let result = '';

  if (userComments.length > 0) {
    result += '=== USER-BASED COMMENTS ===\n\n';
    result += userComments.map(comment => {
      const pinnedByDefault = comment.pinnedByDefault ? 'Yes' : 'No';
      return `Title: ${comment.title}\nUsername: u/${comment.username}\nComment: ${comment.comment}\nPinned by default: ${pinnedByDefault}\n`;
    }).join('\n');
    result += '\n';
  }

  if (comments.length > 0) {
    result += '=== FLAIR-BASED COMMENTS ===\n\n';
    result += comments.map(comment => {
      const flairNames = comment.flairs.length > 0
        ? comment.flairs.map(flairId => flairMap.get(flairId) || flairId).join(';')
        : '';

      const displayOnAll = comment.displayOnAllPosts ? 'Yes' : 'No';
      const pinnedByDefault = comment.pinnedByDefault ? 'Yes' : 'No';

      return `Title: ${comment.title}\nComment: ${comment.comment}\nFlairs: ${flairNames}\nDisplay on all posts: ${displayOnAll}\nPinned by default: ${pinnedByDefault}\n`;
    }).join('\n');
  }

  return result;
}

// Form handlers
const onSubmitCommentHandler = async (event: FormOnSubmitEvent<JSONObject>, context: Devvit.Context) => {
  const { selectedComment, isSticky, postId } = event.values as { selectedComment: string[]; isSticky: boolean; postId: string };

  if (selectedComment) {
    let comment = selectedComment[0];

    let message = 'Comment added';
    const commentResponse = await context.reddit.submitComment({
      id: postId as string,
      text: comment as string
    });

    if (isSticky) {
      commentResponse.distinguish(true);
      message += ' and pinned';
    }
    message += '.';
    context.ui.showToast(message);
  }
};

const onCreateCommentHandler = async (event: FormOnSubmitEvent<JSONObject>, context: Devvit.Context) => {
  const { title, comment, selectedFlairs, displayOnAllPosts, pinnedByDefault } = event.values;

  const comments = await getStoredComments(context);
  const newComment: Comment = {
    id: await getNextId(context),
    title: title as string,
    comment: comment as string,
    flairs: Array.isArray(selectedFlairs) ? selectedFlairs as string[] : [],
    displayOnAllPosts: displayOnAllPosts as boolean || false,
    pinnedByDefault: pinnedByDefault as boolean || false
  };

  comments.push(newComment);
  await saveComments(context, comments);

  context.ui.showToast(`Comment template "${title}" created successfully!`);
};

const onCreateUserCommentHandler = async (event: FormOnSubmitEvent<JSONObject>, context: Devvit.Context) => {
  const { title, comment, username, pinnedByDefault } = event.values;

  const userComments = await getStoredUserComments(context);

  // Clean username (remove u/ if present)
  const cleanUsername = (username as string).replace(/^u\//, '').trim();

  // Check if username already exists
  const existingComment = userComments.find(c => c.username.toLowerCase() === cleanUsername.toLowerCase());
  if (existingComment) {
    context.ui.showToast(`A comment template for u/${cleanUsername} already exists. Use Edit to modify it.`);
    return;
  }

  const newUserComment: UserComment = {
    id: await getNextUserId(context),
    title: title as string,
    comment: comment as string,
    username: cleanUsername,
    pinnedByDefault: pinnedByDefault as boolean || false
  };

  userComments.push(newUserComment);
  await saveUserComments(context, userComments);

  context.ui.showToast(`User comment template for u/${cleanUsername} created successfully!`);
};

const onEditCommentHandler = async (event: FormOnSubmitEvent<JSONObject>, context: Devvit.Context) => {
  const { commentId, title, comment, selectedFlairs, displayOnAllPosts, pinnedByDefault } = event.values;

  const comments = await getStoredComments(context);
  const commentIndex = comments.findIndex(c => c.id === commentId);

  if (commentIndex !== -1) {
    comments[commentIndex] = {
      id: commentId as string,
      title: title as string,
      comment: comment as string,
      flairs: Array.isArray(selectedFlairs) ? selectedFlairs as string[] : [],
      displayOnAllPosts: displayOnAllPosts as boolean || false,
      pinnedByDefault: pinnedByDefault as boolean || false
    };

    await saveComments(context, comments);
    context.ui.showToast(`Comment template "${title}" updated successfully!`);
  } else {
    context.ui.showToast('Error: Comment not found');
  }
};

const onDeleteCommentHandler = async (event: FormOnSubmitEvent<JSONObject>, context: Devvit.Context) => {
  const { commentId, confirmation } = event.values;

  if (confirmation !== 'DELETE') {
    context.ui.showToast('Deletion cancelled - confirmation text did not match');
    return;
  }

  const comments = await getStoredComments(context);
  const filteredComments = comments.filter(c => c.id !== commentId);

  if (filteredComments.length < comments.length) {
    await saveComments(context, filteredComments);
    context.ui.showToast('Comment template deleted successfully!');
  } else {
    context.ui.showToast('Error: Comment not found');
  }
};

// Forms
const commentModal = Devvit.createForm((data) => ({
  title: "Add existing comment",
  fields: [
    {
      name: 'postId',
      label: 'Post Id',
      type: 'string',
      disabled: true,
      defaultValue: data.postId
    },
    {
      name: 'selectedComment',
      type: 'select',
      label: 'Comment',
      options: data.predefinedComments,
      multiSelect: false,
      required: true
    },
    {
      name: 'isSticky',
      type: 'boolean',
      label: 'Sticky comment',
      defaultValue: data.defaultValuePinComment
    },
  ],
  acceptLabel: 'Add comment',
  cancelLabel: 'Cancel'
}), onSubmitCommentHandler);

const createCommentModal = Devvit.createForm((data) => ({
  title: "Create new comment template",
  fields: [
    {
      name: 'title',
      label: 'Template Title',
      type: 'string',
      required: true,
      helpText: 'A short name for this comment template'
    },
    {
      name: 'comment',
      label: 'Comment Text',
      type: 'paragraph',
      required: true,
      helpText: 'The comment text'
    },
    {
      name: 'selectedFlairs',
      label: 'Associated Post Flairs (Optional)',
      type: 'select',
      options: data.flairs,
      multiSelect: true,
      helpText: 'Select flairs that should trigger this comment automatically'
    },
    {
      name: 'displayOnAllPosts',
      label: 'Display on all posts',
      type: 'boolean',
      defaultValue: false,
      helpText: 'If enabled, this comment will be automatically posted on every new post, regardless of flair'
    },
    {
      name: 'pinnedByDefault',
      label: 'Pinned by default',
      type: 'boolean',
      defaultValue: false,
      helpText: 'If enabled, this comment will be automatically pinned when posted'
    }
  ],
  acceptLabel: 'Create Template',
  cancelLabel: 'Cancel'
}), onCreateCommentHandler);

const createUserCommentModal = Devvit.createForm(() => ({
  title: "Create user-based comment template",
  fields: [
    {
      name: 'title',
      label: 'Template Title',
      type: 'string',
      required: true,
      helpText: 'A short name for this user comment template'
    },
    {
      name: 'username',
      label: 'Username',
      type: 'string',
      required: true,
      helpText: 'Username (with or without u/ prefix, e.g., "alice" or "u/alice")'
    },
    {
      name: 'comment',
      label: 'Comment Text',
      type: 'paragraph',
      required: true,
      helpText: 'The comment text to post when this user creates a post'
    },
    {
      name: 'pinnedByDefault',
      label: 'Pinned by default',
      type: 'boolean',
      defaultValue: false,
      helpText: 'If enabled, this comment will be automatically pinned when posted'
    }
  ],
  acceptLabel: 'Create User Template',
  cancelLabel: 'Cancel'
}), onCreateUserCommentHandler);

const editCommentModal = Devvit.createForm((data) => ({
  title: "Edit comment template",
  fields: [
    {
      name: 'selectedTemplate',
      label: 'Select Template to Edit',
      type: 'select',
      options: [
        { label: 'Select a template...', value: '' },
        ...data.comments.map((c: Comment) => ({
          label: `${c.title} (Flairs: ${c.flairs.length > 0 ? c.flairs.join(', ') : 'None'}) ${c.displayOnAllPosts ? '[All Posts]' : ''} ${c.pinnedByDefault ? '[Pinned]' : ''}`,
          value: c.id
        }))
      ],
      multiSelect: false,
      helpText: 'Select a template to edit. Open View All Templates to see all original text.',
    },
    {
      name: 'title',
      label: 'Template Title',
      type: 'string',
      required: true,
      helpText: 'A short name for this comment template.'
    },
    {
      name: 'comment',
      label: 'Comment Text',
      type: 'paragraph',
      required: true,
      helpText: 'The comment text.'
    },
    {
      name: 'selectedFlairs',
      label: 'Associated Post Flairs (Optional)',
      type: 'select',
      options: data.flairs,
      multiSelect: true,
      helpText: 'Select flairs that should trigger this comment automatically.'
    },
    {
      name: 'displayOnAllPosts',
      label: 'Display on all posts',
      type: 'boolean',
      defaultValue: false,
      helpText: 'If enabled, this comment will be automatically posted on every new post, regardless of flair'
    },
    {
      name: 'pinnedByDefault',
      label: 'Pinned by default',
      type: 'boolean',
      defaultValue: false,
      helpText: 'If enabled, this comment will be automatically pinned when posted'
    }
  ],
  acceptLabel: 'Update Template',
  cancelLabel: 'Cancel'
}), async (event: FormOnSubmitEvent<JSONObject>, context: Devvit.Context) => {
  const { selectedTemplate, title, comment, selectedFlairs, displayOnAllPosts, pinnedByDefault } = event.values as 
  {
    selectedTemplate: string[];
    title: string;
    comment: string;
    selectedFlairs: string[];
    displayOnAllPosts: boolean;
    pinnedByDefault: boolean;
  };

  if (!selectedTemplate) {
    context.ui.showToast('Please select a template to edit');
    return;
  }

  const comments = await getStoredComments(context);
  const commentIndex = comments.findIndex(c => c.id === selectedTemplate[0]);

  if (commentIndex !== -1) {
    comments[commentIndex] = {
      id: selectedTemplate[0] as string,
      title: title as string,
      comment: comment as string,
      flairs: Array.isArray(selectedFlairs) ? selectedFlairs as string[] : [],
      displayOnAllPosts: displayOnAllPosts as boolean || false,
      pinnedByDefault: pinnedByDefault as boolean || false
    };

    await saveComments(context, comments);
    context.ui.showToast(`Comment template "${title}" updated successfully!`);
  } else {
    context.ui.showToast('Error: Comment not found');
  }
});

const editUserCommentModal = Devvit.createForm((data) => ({
  title: "Edit user comment template",
  fields: [
    {
      name: 'selectedTemplate',
      label: 'Select User Template to Edit',
      type: 'select',
      options: [
        { label: 'Select a user template...', value: '' },
        ...data.userComments.map((c: UserComment) => ({
          label: `${c.title} (u/${c.username}) ${c.pinnedByDefault ? '[Pinned]' : ''}`,
          value: c.id
        }))
      ],
      multiSelect: false,
      helpText: 'Select a user template to edit. Open View All Templates to see all original text.',
    },
    {
      name: 'title',
      label: 'Template Title',
      type: 'string',
      required: true,
      helpText: 'A short name for this user comment template.'
    },
    {
      name: 'username',
      label: 'Username',
      type: 'string',
      required: true,
      helpText: 'Username (with or without u/ prefix)'
    },
    {
      name: 'comment',
      label: 'Comment Text',
      type: 'paragraph',
      required: true,
      helpText: 'The comment text to post when this user creates a post.'
    },
    {
      name: 'pinnedByDefault',
      label: 'Pinned by default',
      type: 'boolean',
      defaultValue: false,
      helpText: 'If enabled, this comment will be automatically pinned when posted'
    }
  ],
  acceptLabel: 'Update User Template',
  cancelLabel: 'Cancel'
}), async (event: FormOnSubmitEvent<JSONObject>, context: Devvit.Context) => {
  const { selectedTemplate, title, username, comment, pinnedByDefault } = event.values as {
    selectedTemplate: string[];
    title: string;
    username: string;
    comment: string;
    pinnedByDefault: boolean;
  };

  if (!selectedTemplate) {
    context.ui.showToast('Please select a user template to edit');
    return;
  }

  const userComments = await getStoredUserComments(context);
  const commentIndex = userComments.findIndex(c => c.id === selectedTemplate[0]);

  if (commentIndex !== -1) {
    const cleanUsername = (username as string).replace(/^u\//, '').trim();

    // Check if username already exists (but allow editing the same one)
    const existingComment = userComments.find(c =>
      c.username.toLowerCase() === cleanUsername.toLowerCase() &&
      c.id !== selectedTemplate[0]
    );
    if (existingComment) {
      context.ui.showToast(`A comment template for u/${cleanUsername} already exists.`);
      return;
    }

    userComments[commentIndex] = {
      id: selectedTemplate[0] as string,
      title: title as string,
      comment: comment as string,
      username: cleanUsername,
      pinnedByDefault: pinnedByDefault as boolean || false
    };

    await saveUserComments(context, userComments);
    context.ui.showToast(`User comment template "${title}" updated successfully!`);
  } else {
    context.ui.showToast('Error: User comment not found');
  }
});

const deleteCommentModal = Devvit.createForm((data) => ({
  title: "Delete comment template",
  fields: [
    {
      name: 'selectedTemplate',
      label: 'Select Template to Delete',
      type: 'select',
      options: [
        { label: 'Select a template...', value: '' },
        ...data.comments.map((c: Comment) => ({
          label: `${c.title} (Flairs: ${c.flairs.length > 0 ? c.flairs.join(', ') : 'None'}) ${c.displayOnAllPosts ? '[All Posts]' : ''} ${c.pinnedByDefault ? '[Pinned]' : ''}`,
          value: c.id
        }))
      ],
      multiSelect: false,
      required: true,
      helpText: 'Select the template you want to delete'
    }
  ],
  acceptLabel: 'Delete Template',
  cancelLabel: 'Cancel'
}), async (event: FormOnSubmitEvent<JSONObject>, context: Devvit.Context) => {
  const { selectedTemplate } = event.values as { selectedTemplate: string[] };

  if (!selectedTemplate) {
    context.ui.showToast('Please select a template to delete');
    return;
  }

  const comments = await getStoredComments(context);
  const commentToDelete = comments.find(c => c.id === selectedTemplate[0]);

  if (!commentToDelete) {
    context.ui.showToast('Error: No comment found with the selected ID');
    return;
  }
  const filteredComments = comments.filter(c => c.id !== selectedTemplate[0]);

  if (filteredComments.length < comments.length) {
    await saveComments(context, filteredComments);
    context.ui.showToast(`Comment template "${commentToDelete?.title}" deleted successfully!`);
  } else {
    context.ui.showToast('Error: Comment not found');
  }
});

const deleteUserCommentModal = Devvit.createForm((data) => ({
  title: "Delete user comment template",
  fields: [
    {
      name: 'selectedTemplate',
      label: 'Select User Template to Delete',
      type: 'select',
      options: [
        { label: 'Select a user template...', value: '' },
        ...data.userComments.map((c: UserComment) => ({
          label: `${c.title} (u/${c.username}) ${c.pinnedByDefault ? '[Pinned]' : ''}`,
          value: c.id
        }))
      ],
      multiSelect: false,
      required: true,
      helpText: 'Select the user template you want to delete'
    }
  ],
  acceptLabel: 'Delete User Template',
  cancelLabel: 'Cancel'
}), async (event: FormOnSubmitEvent<JSONObject>, context: Devvit.Context) => {
  const { selectedTemplate } = event.values as { selectedTemplate: string[] };

  if (!selectedTemplate) {
    context.ui.showToast('Please select a user template to delete');
    return;
  }

  const userComments = await getStoredUserComments(context);
  const commentToDelete = userComments.find(c => c.id === selectedTemplate[0]);

  if (!commentToDelete) {
    context.ui.showToast('Error: No user comment found with the selected ID');
    return;
  }

  const filteredComments = userComments.filter(c => c.id !== selectedTemplate[0]);

  if (filteredComments.length < userComments.length) {
    await saveUserComments(context, filteredComments);
    context.ui.showToast(`User comment template "${commentToDelete?.title}" deleted successfully!`);
  } else {
    context.ui.showToast('Error: User comment not found');
  }
});

// New form for viewing all comments
const viewAllCommentsModal = Devvit.createForm((data) => ({
  title: "View All Comment Templates",
  fields: [
    {
      name: 'allComments',
      label: 'All Comment Templates',
      type: 'paragraph',
      lineHeight: 20,
      defaultValue: data.formattedComments,
      disabled: false,
      helpText: 'This is a read-only view of all your comment templates.'
    }
  ],
  acceptLabel: 'Close but blue',
  cancelLabel: 'Close'
}), async (event: FormOnSubmitEvent<JSONObject>, context: Devvit.Context) => {
  // No action needed, just close the form
});

// Menu items
Devvit.addMenuItem({
  location: 'post',
  forUserType: 'moderator',
  label: 'El Commentator: Post Predefined Comment',
  onPress: async (event, context) => {
    try {
      const comments = await getStoredComments(context);
      const userComments = await getStoredUserComments(context);
      const settings = await context.settings.getAll();

      const allComments = [
        ...comments.map(c => ({ label: `[Flair] ${c.title}`, value: c.comment })),
        ...userComments.map(c => ({ label: `[User] ${c.title} (u/${c.username})`, value: c.comment }))
      ];

      if (allComments.length === 0) {
        context.ui.showToast('No comment templates found. Create one first using "Create Comment Template"');
        return;
      }

      context.ui.showForm(commentModal, {
        postId: context.postId as string,
        predefinedComments: allComments,
        defaultValuePinComment: settings.defaultValuePinComment as boolean
      });
    } catch (error) {
      context.ui.showToast(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});

Devvit.addMenuItem({
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'El Commentator: Create Comment Template',
  onPress: async (event, context) => {
    try {
      const flairs = await getSubredditFlairs(context);

      context.ui.showForm(createCommentModal, {
        flairs: flairs.map(f => ({ label: f.text, value: f.id }))
      });
    } catch (error) {
      context.ui.showToast(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});

Devvit.addMenuItem({
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'El Commentator: Create User Comment Template',
  onPress: async (event, context) => {
    try {
      context.ui.showForm(createUserCommentModal);
    } catch (error) {
      context.ui.showToast(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});

Devvit.addMenuItem({
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'El Commentator: Edit Comment Template',
  onPress: async (event, context) => {
    try {
      const comments = await getStoredComments(context);
      const flairs = await getSubredditFlairs(context);

      if (comments.length === 0) {
        context.ui.showToast('No comment templates found. Create one first using "Create Comment Template"');
        return;
      }
      context.ui.showForm(editCommentModal, {
        comments: comments,
        flairs: flairs.map(f => ({ label: f.text, value: f.id }))
      });
    } catch (error) {
      context.ui.showToast(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});

Devvit.addMenuItem({
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'El Commentator: Edit User Comment Template',
  onPress: async (event, context) => {
    try {
      const userComments = await getStoredUserComments(context);

      if (userComments.length === 0) {
        context.ui.showToast('No user comment templates found. Create one first using "Create User Comment Template"');
        return;
      }

      context.ui.showForm(editUserCommentModal, {
        userComments: userComments
      });
    } catch (error) {
      context.ui.showToast(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});

Devvit.addMenuItem({
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'El Commentator: Delete Comment Template',
  onPress: async (event, context) => {
    try {
      const comments = await getStoredComments(context);

      if (comments.length === 0) {
        context.ui.showToast('No comment templates found. Nothing to delete.');
        return;
      }

      context.ui.showForm(deleteCommentModal, {
        comments: comments
      });
    } catch (error) {
      context.ui.showToast(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});

Devvit.addMenuItem({
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'El Commentator: Delete User Comment Template',
  onPress: async (event, context) => {
    try {
      const userComments = await getStoredUserComments(context);

      if (userComments.length === 0) {
        context.ui.showToast('No user comment templates found. Nothing to delete.');
        return;
      }

      context.ui.showForm(deleteUserCommentModal, {
        userComments: userComments
      });
    } catch (error) {
      context.ui.showToast(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});

// New menu item for viewing all comments
Devvit.addMenuItem({
  location: 'subreddit',
  forUserType: 'moderator',
  label: 'El Commentator: View All Templates',
  onPress: async (event, context) => {
    try {
      const formattedComments = await formatAllComments(context);

      context.ui.showForm(viewAllCommentsModal, {
        formattedComments: formattedComments
      });
    } catch (error) {
      context.ui.showToast(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});

// Enhanced Auto-comment trigger with priority system and user-based comments
Devvit.addTrigger({
  event: 'PostSubmit',
  onEvent: async (event, context) => {
    const settings = await context.settings.getAll();

    if (!settings.autoCommentEnabled) {
      return; // Auto-commenting is disabled
    }

    try {
      const post = event.post;
      if (post) {
        const comments = await getStoredComments(context);
        const userComments = await getStoredUserComments(context);
        const user = await context.reddit.getUserById(post.authorId as string)

        let selectedComment: Comment | null = null;
        let selectedUserComment: UserComment | null = null;
        const postFlairId = post?.linkFlair?.templateId;
        const postAuthor = user?.username;

        // First, check for user-based comments
        if (postAuthor) {
          selectedUserComment = userComments.find(c =>
            c.username.toLowerCase() === postAuthor.toLowerCase()
          ) || null;
        }

        // Then, check for flair-based comments (existing logic)
        if (postFlairId) {
          // Priority 1: Comments with exactly 1 flair that matches the post flair
          const singleFlairComments = comments.filter(c =>
            c.flairs.length === 1 &&
            c.flairs[0] === postFlairId &&
            !c.displayOnAllPosts
          );

          if (singleFlairComments.length > 0) {
            selectedComment = singleFlairComments[0]; // Take the first one if multiple exist
          }

          // Priority 2: Comments with multiple flairs that include the post flair
          if (!selectedComment) {
            const multipleFlairComments = comments.filter(c =>
              c.flairs.length > 1 &&
              c.flairs.includes(postFlairId) &&
              !c.displayOnAllPosts
            );

            if (multipleFlairComments.length > 0) {
              selectedComment = multipleFlairComments[0]; // Take the first one if multiple exist
            }
          }
        }

        // Priority 3: Comments that should be displayed on all posts
        if (!selectedComment) {
          const allPostsComments = comments.filter(c => c.displayOnAllPosts);

          if (allPostsComments.length > 0) {
            selectedComment = allPostsComments[0]; // Take the first one if multiple exist
          }
        }

        // Construct the final comment text
        let finalCommentText = '';
        let shouldPin = false;

        if (selectedUserComment) {
          finalCommentText = selectedUserComment.comment;
          shouldPin = selectedUserComment.pinnedByDefault;

          // If there's also a flair/general comment, add it after a separator
          if (selectedComment) {
            finalCommentText += '\n\n---\n\n' + selectedComment.comment;
            // If either comment should be pinned, pin the combined comment
            shouldPin = shouldPin || selectedComment.pinnedByDefault;
          }
        } else if (selectedComment) {
          finalCommentText = selectedComment.comment;
          shouldPin = selectedComment.pinnedByDefault;
        }

        // Post the comment if we have one
        if (finalCommentText) {
          const commentResponse = await context.reddit.submitComment({
            id: post.id,
            text: finalCommentText
          });

          // Pin the comment if needed
          if (shouldPin) {
            await commentResponse.distinguish(true);
          }

          let logMessage = '';
          if (selectedUserComment && selectedComment) {
            logMessage = `Auto-posted combined comment for user "${selectedUserComment.username}" and template "${selectedComment.title}" on post ${post.id}`;
          } else if (selectedUserComment) {
            logMessage = `Auto-posted user comment "${selectedUserComment.title}" for u/${selectedUserComment.username} on post ${post.id}`;
          } else if (selectedComment) {
            logMessage = `Auto-posted comment "${selectedComment.title}" on post ${post.id} (flair: ${postFlairId || 'none'})`;
          }
        }
      }
    } catch (error) {
      console.error('Error in auto-comment trigger:', error);
    }
  }
});

export default Devvit;