import { Devvit, JSONObject, FormOnSubmitEvent, TriggerContext } from '@devvit/public-api';

type Comment = {
  id: string;
  title: string;
  comment: string;
  flairs: string[]; // Array of flair IDs that should trigger this comment
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

// Form handlers
const onSubmitCommentHandler = async (event: FormOnSubmitEvent<JSONObject>, context: Devvit.Context) => {
  const { selectedComment, isSticky, postId } = event.values;
  
  let comment = selectedComment;

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
};

const onCreateCommentHandler = async (event: FormOnSubmitEvent<JSONObject>, context: Devvit.Context) => {
  const { title, comment, selectedFlairs } = event.values;
  
  const comments = await getStoredComments(context);
  const newComment: Comment = {
    id: await getNextId(context),
    title: title as string,
    comment: comment as string,
    flairs: Array.isArray(selectedFlairs) ? selectedFlairs as string[] : []
  };
  
  comments.push(newComment);
  await saveComments(context, comments);
  
  context.ui.showToast(`Comment template "${title}" created successfully!`);
};

const onEditCommentHandler = async (event: FormOnSubmitEvent<JSONObject>, context: Devvit.Context) => {
  const { commentId, title, comment, selectedFlairs } = event.values;
  
  const comments = await getStoredComments(context);
  const commentIndex = comments.findIndex(c => c.id === commentId);
  
  if (commentIndex !== -1) {
    comments[commentIndex] = {
      id: commentId as string,
      title: title as string,
      comment: comment as string,
      flairs: Array.isArray(selectedFlairs) ? selectedFlairs as string[] : []
    };
    
    await saveComments(context, comments);
    context.ui.showToast(`Comment template "${title}" updated successfully!`);
  } else {
    context.ui.showToast('Error: Comment not found');
  }
};

const onDeleteCommentHandler = async (event: FormOnSubmitEvent<JSONObject>, context: Devvit.Context) => {
  const { commentId } = event.values;
  
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
      multiSelect: false
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
      helpText: 'The comment text. Use \\n for line breaks.'
    },
    {
      name: 'selectedFlairs',
      label: 'Associated Post Flairs (Optional)',
      type: 'select',
      options: data.flairs,
      multiSelect: true,
      helpText: 'Select flairs that should trigger this comment automatically'
    }
  ],
  acceptLabel: 'Create Template',
  cancelLabel: 'Cancel'
}), onCreateCommentHandler);

const editCommentModal = Devvit.createForm((data) => ({
  title: `Edit comment template: ${data.title}`,
  fields: [
    {
      name: 'commentId',
      type: 'string',
      defaultValue: data.commentId,
      disabled: true,
      label: 'ID'
    },
    {
      name: 'title',
      label: 'Template Title',
      type: 'string',
      required: true,
      defaultValue: data.title,
      helpText: 'A short name for this comment template'
    },
    {
      name: 'comment',
      label: 'Comment Text',
      type: 'paragraph',
      required: true,
      defaultValue: data.comment,
      helpText: 'The comment text. Use \\n for line breaks.'
    },
    {
      name: 'selectedFlairs',
      label: 'Associated Post Flairs (Optional)',
      type: 'select',
      options: data.flairs,
      multiSelect: true,
      defaultValue: data.selectedFlairs,
      helpText: 'Select flairs that should trigger this comment automatically'
    }
  ],
  acceptLabel: 'Update Template',
  cancelLabel: 'Cancel'
}), onEditCommentHandler);

const deleteConfirmModal = Devvit.createForm((data) => ({
  title: `Delete comment template: ${data.title}`,
  fields: [
    {
      name: 'commentId',
      type: 'string',
      defaultValue: data.commentId,
      disabled: true,
      label: 'Template ID'
    },
    {
      name: 'confirmation',
      type: 'string',
      label: 'Type "DELETE" to confirm',
      required: true,
      helpText: `This will permanently delete the comment template "${data.title}"`
    }
  ],
  acceptLabel: 'Delete Template',
  cancelLabel: 'Cancel'
}), async (event: FormOnSubmitEvent<JSONObject>, context: Devvit.Context) => {
  const { confirmation, commentId } = event.values;
  
  if (confirmation !== 'DELETE') {
    context.ui.showToast('Deletion cancelled - confirmation text did not match');
    return;
  }
  
  await onDeleteCommentHandler(event, context);
});

const manageCommentsModal = Devvit.createForm((data) => ({
  title: "Manage Comment Templates",
  fields: [
    {
      name: 'action',
      label: 'Select Action',
      type: 'select',
      options: [
        { label: 'Create New Template', value: 'create' },
        { label: 'Edit Existing Template', value: 'edit' },
        { label: 'Delete Template', value: 'delete' },
        { label: 'View All Templates', value: 'view' }
      ],
      required: true
    },
    ...(data.comments.length > 0 ? [{
      name: 'selectedComment',
      label: 'Select Template (for Edit/Delete)',
      type: 'select' as const,
      options: data.comments.map((c: Comment) => ({ 
        label: `${c.title} (Flairs: ${c.flairs.length > 0 ? c.flairs.join(', ') : 'None'})`, 
        value: c.id 
      })),
      multiSelect: false
    }] : [])
  ],
  acceptLabel: 'Continue',
  cancelLabel: 'Cancel'
}), async (event: FormOnSubmitEvent<JSONObject>, context: Devvit.Context) => {
  const { action, selectedComment } = event.values;
  const comments = await getStoredComments(context);
  const flairs = await getSubredditFlairs(context);
  
  switch (action) {
    case 'create':
      context.ui.showForm(createCommentModal, {
        flairs: flairs.map(f => ({ label: f.text, value: f.id }))
      });
      break;
      
    case 'edit':
      if (selectedComment) {
        const comment = comments.find(c => c.id === selectedComment);
        if (comment) {
          context.ui.showForm(editCommentModal, {
            commentId: comment.id,
            title: comment.title,
            comment: comment.comment,
            selectedFlairs: comment.flairs,
            flairs: flairs.map(f => ({ label: f.text, value: f.id }))
          });
        }
      } else {
        context.ui.showToast('Please select a comment to edit');
      }
      break;
      
    case 'delete':
      if (selectedComment) {
        const comment = comments.find(c => c.id === selectedComment);
        if (comment) {
          context.ui.showForm(deleteConfirmModal, {
            commentId: comment.id,
            title: comment.title
          });
        }
      } else {
        context.ui.showToast('Please select a comment to delete');
      }
      break;
      
    case 'view':
      if (comments.length === 0) {
        context.ui.showToast('No comment templates found. Create one first!');
      } else {
        const templateList = comments.map(c => 
          `• ${c.title}\n  Flairs: ${c.flairs.length > 0 ? c.flairs.join(', ') : 'None'}\n  Text: ${c.comment.substring(0, 50)}${c.comment.length > 50 ? '...' : ''}`
        ).join('\n\n');
        context.ui.showToast(`Templates:\n\n${templateList}`);
      }
      break;
  }
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
        context.ui.showToast('No comment templates found. Create one first using "Manage Comment Templates"');
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
  label: 'El Commentator: Manage Comment Templates',
  onPress: async (event, context) => {
    try {
      const comments = await getStoredComments(context);
      
      context.ui.showForm(manageCommentsModal, {
        comments: comments
      });
    } catch (error) {
      context.ui.showToast(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
});

// Future: Auto-comment trigger (for later implementation)
// This would be triggered when a post is created with a matching flair
Devvit.addTrigger({
  event: 'PostSubmit',
  onEvent: async (event, context) => {
    const settings = await context.settings.getAll();
    
    if (!settings.autoCommentEnabled) {
      return; // Auto-commenting is disabled
    }
    
    try {
      const post = event.post;
      if (!post?.linkFlair?.templateId) {
        return; // No flair on the post
      }
      
      const comments = await getStoredComments(context);
      const matchingComments = comments.filter(c => 
        c.flairs.includes(post.linkFlair!.templateId!)
      );
      
      for (const comment of matchingComments) {
        await context.reddit.submitComment({
          id: post.id,
          text: comment.comment
        });
      }
      
      if (matchingComments.length > 0) {
        console.log(`Auto-posted ${matchingComments.length} comment(s) for flair ${post.linkFlair.templateId}`);
      }
    } catch (error) {
      console.error('Error in auto-comment trigger:', error);
    }
  }
});

export default Devvit;