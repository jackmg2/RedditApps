import { MenuItem } from '@devvit/public-api';
import { AppSettings, ApprovalFormData } from '../types/AppSettings.js';
import { FlairService } from '../services/flairService.js';
import { modalApprovePost } from '../forms/approvePostForm.js';
import { modalApproveComment } from '../forms/approveCommentForm.js';

async function getApprovalFormData(
  context: any
): Promise<ApprovalFormData> {
  let author, postId, commentId;

  if (context.commentId) {
    const comment = await context.reddit.getCommentById(context.commentId as string);
    author = await context.reddit.getUserById(comment.authorId as string);
    postId = comment.postId;
    commentId = comment.id;
  } else {
    const post = await context.reddit.getPostById(context.postId as string);
    author = await context.reddit.getUserById(post.authorId as string);
    postId = post.id;
  }

  const subRedditName = (await context.reddit.getCurrentSubreddit()).name;
  const flairTemplates = await FlairService.getFlairTemplates(context, subRedditName);
  const defaultFlair = [flairTemplates[0].value];
  const settings = await context.settings.getAll() as AppSettings;

  return {
    username: author ? author.username : '',
    subRedditName: subRedditName,
    postId: postId,
    commentId: commentId,
    flairTemplates: flairTemplates,
    defaultFlair: defaultFlair,
    defaultComment: settings.defaultComment || '',
    defaultValueApproveUser: settings.defaultValueApproveUser,
    defaultValueApprovePost: settings.defaultValueApprovePost,
    defaultValueApproveComment: settings.defaultValueApproveComment
  };
}

export const verifyAndApprovePostMenuItem: MenuItem = {
  location: 'post',
  forUserType: 'moderator',
  label: 'Approve & Flair: Verify and Approve',
  onPress: async (event, context) => {
    const formData = await getApprovalFormData(context);
    context.ui.showForm(modalApprovePost, { ...formData });
  }
};

export const verifyAndApproveCommentMenuItem: MenuItem = {
  location: 'comment',
  forUserType: 'moderator',
  label: 'Approve & Flair: Verify and Approve',
  onPress: async (event, context) => {
    const formData = await getApprovalFormData(context);
    context.ui.showForm(modalApproveComment, { ...formData });
  }
};