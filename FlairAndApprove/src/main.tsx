import { Devvit, FlairTemplate, JSONObject, FormOnSubmitEvent } from '@devvit/public-api';

Devvit.configure({ redditAPI: true, http: false });

Devvit.addSettings([
  {
    name: 'defaultComment',
    label: 'Default Comment',
    type: 'paragraph',
    helpText: 'Enter the default comment to be used when approving posts.',
  },
  {
    name: 'defaultValueApproveUser',
    label: 'Check Approve User by default',
    type: 'boolean',
  },
  {
    name: 'defaultValueApprovePost',
    label: 'Check Approve Post by default',
    type: 'boolean',
  },
  {
    name: 'defaultValueApproveComment',
    label: 'Check Approve Comment by default',
    type: 'boolean',
  },
]);

const onSubmitHandler = async (event: FormOnSubmitEvent<JSONObject>, context: Devvit.Context) => {
  const { subRedditName, username, selectedFlair, postId, commentId, approveUser, approvePost, approveComment, comment } = event.values;
  const actions = [
    {
      // Apply selected flair to the author
      task: () => context.reddit.setUserFlair({
        subredditName: subRedditName as string,
        username: username as string,
        flairTemplateId: (selectedFlair as string[])[0]
      }),
      successMessage: 'Flair applied successfully.'
    },
    // Approve user
    ...(approveUser ? [{
      task: () => context.reddit.approveUser(username as string, subRedditName as string),
      successMessage: `${username} approved.`
    }] : []),
    // Approve post (only if not a comment action)
    ...(approvePost ? [{
      task: () => context.reddit.approve(postId as string),
      successMessage: 'Post approved.'
    }] : []),
    // Approve comment (only if it's a comment action)
    ...(approveComment ? [{
      task: () => context.reddit.approve(commentId as string),
      successMessage: 'Comment approved.'
    }] : []),
    // Comment and pin (use commentId if it's a comment action, otherwise postId)
    ...(comment ? [{
      task: async () => {
        const targetId = commentId ? commentId as string : postId as string;
        const commentResponse = await context.reddit.submitComment({
          id: targetId,
          text: comment as string
        });
        commentResponse.distinguish(true);
      },
      successMessage: 'Comment posted and pinned.'
    }] : [])
  ];

  // Wait for all promises
  try {
    const results = await Promise.allSettled(actions.map(action => action.task()));

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        context.ui.showToast(actions[index].successMessage);
      } else {
        context.ui.showToast(`Error: ${actions[index].successMessage} failed.`);
      }
    });
  } catch (error) {
    if (error instanceof Error) {
      context.ui.showToast(`An error occurred: ${error.message}`);
    }
  }
}

const modalApprovePost = Devvit.createForm((data) => ({
  title: `Approve and apply flair to ${data.username}`,
  fields: [
    {
      name: 'subRedditName',
      label: 'SubReddit',
      type: 'string',
      disabled: true,
      defaultValue: data.subRedditName
    },
    {
      name: 'username',
      label: 'Username',
      type: 'string',
      disabled: true,
      defaultValue: data.username
    },
    {
      name: 'postId',
      label: 'Post Id',
      type: 'string',
      disabled: true,
      defaultValue: data.postId
    },
    {
      name: 'isCommentAction',
      type: 'boolean',
      label: 'Is Comment Action',
      disabled: true,
      defaultValue: data.isCommentAction
    },
    {
      name: 'selectedFlair',
      type: 'select',
      label: 'Flair',
      options: data.flairTemplates,
      defaultValue: data.defaultFlair,
      multiSelect: false
    },
    {
      name: 'comment',
      type: 'paragraph',
      label: 'Comment',
      defaultValue: data.defaultComment
    },
    {
      name: 'approveUser',
      type: 'boolean',
      label: 'Approve user',
      defaultValue: data.defaultValueApproveUser
    }, {
      name: 'approvePost',
      type: 'boolean',
      label: 'Approve post',
      defaultValue: data.defaultValueApprovePost
    }
  ],
  acceptLabel: 'Submit',
  cancelLabel: 'Cancel',
}), onSubmitHandler);

const modalApproveComment = Devvit.createForm((data) => ({
  title: `Approve and apply flair to ${data.username}`,
  fields: [
    {
      name: 'subRedditName',
      label: 'SubReddit',
      type: 'string',
      disabled: true,
      defaultValue: data.subRedditName
    },
    {
      name: 'username',
      label: 'Username',
      type: 'string',
      disabled: true,
      defaultValue: data.username
    },
    {
      name: 'commentId',
      label: 'Comment Id',
      type: 'string',
      disabled: true,
      defaultValue: data.commentId
    },
    {
      name: 'selectedFlair',
      type: 'select',
      label: 'Flair',
      options: data.flairTemplates,
      defaultValue: data.defaultFlair,
      multiSelect: false
    },
    {
      name: 'comment',
      type: 'paragraph',
      label: 'Comment',
      defaultValue: data.defaultComment
    },
    {
      name: 'approveUser',
      type: 'boolean',
      label: 'Approve user',
      defaultValue: data.defaultValueApproveUser
    },
    {
      name: 'approveComment',
      type: 'boolean',
      label: 'Approve comment',
      defaultValue: data.defaultValueApproveComment
    }
  ],
  acceptLabel: 'Submit',
  cancelLabel: 'Cancel',
}), onSubmitHandler);

const handleVerifyAndApprove = async (context: Devvit.Context) => {
  let author, postId, commentId;

  if (context.commentId) {
    // Handle comment action
    const comment = await context.reddit.getCommentById(context.commentId as string);
    author = await context.reddit.getUserById(comment.authorId as string);
    postId = comment.postId;
    commentId = comment.id;
  } else {
    // Handle post action
    const post = await context.reddit.getPostById(context.postId as string);
    author = await context.reddit.getUserById(post.authorId as string);
    postId = post.id;
  }

  // Get common data needed for both actions
  const subRedditName = (await context.reddit.getCurrentSubreddit()).name;
  const flairTemplates = (await context.reddit.getUserFlairTemplates(subRedditName))
    .map((flair: FlairTemplate) => ({ label: flair.text, value: flair.id }));
  const defaultFlair = [flairTemplates[0].value];
  const settings = await context.settings.getAll();
  const defaultComment = settings.defaultComment as string || '';
  const defaultValueApproveUser = settings.defaultValueApproveUser as boolean;
  const defaultValueApprovePost = settings.defaultValueApprovePost as boolean;
  const defaultValueApproveComment = settings.defaultValueApproveComment as boolean;

  // Show the form with appropriate data
  const modalData = {
    username: author ? author.username : '',
    subRedditName: subRedditName,
    postId: postId,
    commentId: commentId,
    flairTemplates: flairTemplates,
    defaultFlair: defaultFlair,
    defaultComment: defaultComment,
    defaultValueApproveUser: defaultValueApproveUser,
    defaultValueApprovePost: defaultValueApprovePost,
    defaultValueApproveComment: defaultValueApproveComment
  };

  if (context.commentId) {
    context.ui.showForm(modalApproveComment, {
      username: author ? author.username : '',
      subRedditName: subRedditName,
      postId: postId,
      commentId: commentId as string,
      flairTemplates: flairTemplates,
      defaultFlair: defaultFlair,
      defaultComment: defaultComment,
      defaultValueApproveUser: defaultValueApproveUser,
      defaultValueApprovePost: defaultValueApprovePost,
      defaultValueApproveComment: defaultValueApproveComment
    });
  }
  else {
    context.ui.showForm(modalApprovePost, {
      username: author ? author.username : '',
      subRedditName: subRedditName,
      postId: postId,
      flairTemplates: flairTemplates,
      defaultFlair: defaultFlair,
      defaultComment: defaultComment,
      defaultValueApproveUser: defaultValueApproveUser,
      defaultValueApprovePost: defaultValueApprovePost,
      defaultValueApproveComment: defaultValueApproveComment
    });
  }
};

// Post menu item
Devvit.addMenuItem({
  location: 'post',
  forUserType: 'moderator',
  label: 'Verify and Approve',
  onPress: async (event, context) => {
    await handleVerifyAndApprove(context);
  }
});

// Comment menu item
Devvit.addMenuItem({
  location: 'comment',
  forUserType: 'moderator',
  label: 'Verify and Approve',
  onPress: async (event, context) => {
    await handleVerifyAndApprove(context);
  }
});

export default Devvit;
