import { Devvit, FormOnSubmitEvent } from '@devvit/public-api';

type Comment = {
  title: string;
  comment: string;
}

Devvit.configure({ redditAPI: true, http: false });

// Add a custom field to store predefined comments in the app settings
Devvit.addSettings([
  {
    name: 'predefinedComments',
    label: 'Comments',
    type: 'paragraph',
    helpText: 'Json representing the array of comments you want to use.',
    onValidate: ({ value }) => {
      const defaultJson = `[{"title":"First comment","comment":"First comment"},{"title":"Second comment","comment":"Second comment, with comma"},{"title":"Line returns","comment":"Using \n to set \n\n line returns"},{"title":"Link","comment":"[Usual links are available](https://www.perdu.com)"}]`;
      let isValid = true;

      try {
        if (value) {
          const jobsj = JSON.parse(value);
        }
        else {
          isValid = false;
        }
      }
      catch (error) {
        isValid = false;
      }

      if (!isValid) {
        return `You have an error on your json, it must be in the following format: ${defaultJson}`;
      }
    }
  },
  {
    name: 'defaultValuePinComment',
    label: 'Check Sticky Comment by default',
    type: 'boolean',
  },
]);

const onSubmitHandler = async (event: FormOnSubmitEvent, context: Devvit.Context) => {
  const { selectedComment, isSticky, postId } = event.values;
  
  let comment = "";
  if (typeof selectedComment === 'string') {
    comment = selectedComment;
  }
  else {
    comment = selectedComment.join(", ");
  }

  let message = 'Comment added';
  const commentResponse = await context.reddit.submitComment({
    id: postId,
    text: comment
  });
  if (isSticky) {
    commentResponse.distinguish(true);
    message += ' and pinned'
  }
  message += '.';
  context.ui.showToast(message);
};

// Create a modal for selecting and posting comments
const modal = Devvit.createForm((data) => ({
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
}), onSubmitHandler);

// Add a button to posts that opens the comment selector modal
Devvit.addMenuItem({
  location: 'post',
  forUserType: 'moderator',
  label: 'Post Predefined Comment',
  onPress: async (event, context) => {
    try {
      // Get predefined comments from settings
      const settings = await context.settings.getAll();
      const predefinedComments: Comment[] = JSON.parse((settings.predefinedComments as string) || '[]');

      context.ui.showForm(modal, {
        postId: context.postId,
        predefinedComments: predefinedComments.map(c => ({ label: c.title, value: c.comment })),
        defaultValuePinComment: settings.defaultValuePinComment
      });
    }
    catch (error) {
      if (error instanceof Error) {
        context.ui.showToast(`An error occurred, check your Settings json: ${error.message}`);
      }
    }
  }
});

export default Devvit;