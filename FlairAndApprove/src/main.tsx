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
]);

const onSubmitHandler = async (event: FormOnSubmitEvent<JSONObject>, context: Devvit.Context) => {
  const { subRedditName, username, selectedFlair, postId, approveUser, approvePost, comment } = event.values;
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
    // Approve post
    ...(approvePost ? [{
      task: () => context.reddit.approve(postId as string),
      successMessage: 'Post approved.'
    }] : []),
    // Comment and pin
    ...(comment ? [{
      task: async () => {
        const commentResponse = await context.reddit.submitComment({
          id: postId  as string,
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

const modal = Devvit.createForm((data) => ({
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
      name: 'approvePost',
      type: 'boolean',
      label: 'Approve post',
      defaultValue: data.defaultValueApprovePost
    }
  ],
  acceptLabel: 'Submit',
  cancelLabel: 'Cancel',
}), onSubmitHandler);

Devvit.addMenuItem({
  location: 'post',
  forUserType: 'moderator',
  label: 'Verify and Approve',
  onPress: async (event, context) => {
    const post = await context.reddit.getPostById(context.postId as string);
    const author = await context.reddit.getUserById(post.authorId as string);
    const subRedditName = (await context.reddit.getCurrentSubreddit()).name;
    const flairTemplates = (await context.reddit.getUserFlairTemplates(subRedditName)).map((flair: FlairTemplate) => ({ label: flair.text, value: flair.id }));
    const defaultFlair = [flairTemplates[0].value];
    const settings = await context.settings.getAll();
    const defaultComment = settings.defaultComment || '';
    const defaultValueApproveUser = settings.defaultValueApproveUser;
    const defaultValueApprovePost = settings.defaultValueApprovePost;    

    context.ui.showForm(modal, {
      username: author ? author.username : '',
      subRedditName: subRedditName,
      postId: post.id,
      flairTemplates: flairTemplates,
      defaultFlair: defaultFlair,
      defaultComment: defaultComment,
      defaultValueApproveUser: defaultValueApproveUser as boolean,
      defaultValueApprovePost: defaultValueApprovePost as boolean
    });
  }
});

export default Devvit;
