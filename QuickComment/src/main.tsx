import { Devvit, JSONObject, FormOnSubmitEvent, TriggerContext } from '@devvit/public-api';

type Comment = {
  id: string;
  title: string;
  comment: string;
  flairs: string[]; // Array of flair IDs that should trigger this comment
  displayOnAllPosts: boolean; // New field for displaying on all posts
  pinnedByDefault: boolean; // New field for pinning comments by default
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
const NEXT_ID_KEY = 'next_comment_id';

// Helper functions for data management
async function getStoredComments(context: TriggerContext): Promise<Comment[]> {
  const stored = await context.redis.get(COMMENTS_KEY);
  return stored ? JSON.parse(stored) : [];
}

async function saveComments(context: Devvit.Context, comments: Comment[]): Promise<void> {
  await context.redis.set(COMMENTS_KEY, JSON.stringify(comments));
}

async function getNextId(context: Devvit.Context): Promise<string> {
  const current = await context.redis.get(NEXT_ID_KEY);
  const nextId = current ? parseInt(current) + 1 : 1;
  await context.redis.set(NEXT_ID_KEY, nextId.toString());
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
  const flairs = await getSubredditFlairs(context);

  if (comments.length === 0) {
    return "No comment templates found.";
  }

  // Create a map of flair IDs to flair text for display
  const flairMap = new Map(flairs.map(f => [f.id, f.text]));

  return comments.map(comment => {
    const flairNames = comment.flairs.length > 0
      ? comment.flairs.map(flairId => flairMap.get(flairId) || flairId).join(';')
      : '';

    const displayOnAll = comment.displayOnAllPosts ? 'Yes' : 'No';
    const pinnedByDefault = comment.pinnedByDefault ? 'Yes' : 'No';

    return `Title: ${comment.title}\nComment: ${comment.comment}\nFlairs: ${flairNames}\nDisplay on all posts: ${displayOnAll}\nPinned by default: ${pinnedByDefault}\n`;
  }).join('\n');
}

// Form handlers
const onSubmitCommentHandler = async (event: FormOnSubmitEvent<JSONObject>, context: Devvit.Context) => {
  const { selectedComment, isSticky, postId } = event.values;

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
  const { selectedTemplate, title, comment, selectedFlairs, displayOnAllPosts, pinnedByDefault } = event.values;

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
  const { selectedTemplate } = event.values;

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

// New form for viewing all comments
const viewAllCommentsModal = Devvit.createForm((data) => ({
  title: "View All Comment Templates",
  fields: [
    {
      name: 'allComments',
      label: 'All Comment Templates',
      type: 'paragraph',
      lineHeight: 10,
      defaultValue: data.formattedComments,
      disabled: false,
      helpText: 'This is a read-only view of all your comment templates with their associated flairs.'
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
      const settings = await context.settings.getAll();

      if (comments.length === 0) {
        context.ui.showToast('No comment templates found. Create one first using "Create Comment Template"');
        return;
      }

      context.ui.showForm(commentModal, {
        postId: context.postId as string,
        predefinedComments: comments.map(c => ({ label: c.title, value: c.comment })),
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

// Enhanced Auto-comment trigger
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

        // Get comments that should display on all posts
        const allPostsComments = comments.filter(c => c.displayOnAllPosts);

        // Get comments that match the post's flair (if any)
        let flairMatchingComments: Comment[] = [];
        if (post?.linkFlair?.templateId) {
          flairMatchingComments = comments.filter(c =>
            c.flairs.includes(post.linkFlair!.templateId!) && !c.displayOnAllPosts
          );
        }

        // Combine both types of comments, avoiding duplicates
        const commentsToPost = [...allPostsComments, ...flairMatchingComments];
        const uniqueCommentsToPost = commentsToPost.filter((comment, index, self) =>
          index === self.findIndex(c => c.id === comment.id)
        );

        // Post all matching comments
        for (const comment of uniqueCommentsToPost) {
          const commentResponse = await context.reddit.submitComment({
            id: post.id,
            text: comment.comment
          });

          // Pin the comment if it's set to be pinned by default
          if (comment.pinnedByDefault) {
            await commentResponse.distinguish(true);
          }
        }

        if (uniqueCommentsToPost.length > 0) {
          const allPostsCount = allPostsComments.length;
          const flairCount = flairMatchingComments.length;

          console.log(`Auto-posted ${uniqueCommentsToPost.length} comment(s): ${allPostsCount} for all posts, ${flairCount} for flair ${post?.linkFlair?.templateId || 'none'}`);
        }
      }
    } catch (error) {
      console.error('Error in auto-comment trigger:', error);
    }
  }
});

export default Devvit;