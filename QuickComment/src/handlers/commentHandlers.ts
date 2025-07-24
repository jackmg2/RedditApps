import { Devvit, FormOnSubmitEvent, JSONObject } from '@devvit/public-api';
import { Comment } from '../types/index.js';
import { CommentStorage } from '../storage/index.js';
import { postComment } from '../utils/reddit.js';

export async function handlePostComment(
  event: FormOnSubmitEvent<JSONObject>, 
  context: Devvit.Context
): Promise<void> {
  const { selectedComment, isSticky, postId } = event.values as { 
    selectedComment: string[]; 
    isSticky: boolean; 
    postId: string 
  };

  if (selectedComment && selectedComment[0]) {
    await postComment(context, postId, selectedComment[0], isSticky);
  }
}

export async function handleCreateComment(
  event: FormOnSubmitEvent<JSONObject>,
  context: Devvit.Context
): Promise<void> {
  const { title, comment, selectedFlairs, displayOnAllPosts, pinnedByDefault } = event.values;

  const comments = await CommentStorage.getComments(context);
  const newComment: Comment = {
    id: await CommentStorage.getNextId(context),
    title: title as string,
    comment: comment as string,
    flairs: Array.isArray(selectedFlairs) ? selectedFlairs as string[] : [],
    displayOnAllPosts: displayOnAllPosts as boolean || false,
    pinnedByDefault: pinnedByDefault as boolean || false
  };

  comments.push(newComment);
  await CommentStorage.saveComments(context, comments);

  context.ui.showToast(`Comment template "${title}" created successfully!`);
}

export async function handleEditComment(
  event: FormOnSubmitEvent<JSONObject>,
  context: Devvit.Context
): Promise<void> {
  const { selectedTemplate, title, comment, selectedFlairs, displayOnAllPosts, pinnedByDefault } = event.values as {
    selectedTemplate: string[];
    title: string;
    comment: string;
    selectedFlairs: string[];
    displayOnAllPosts: boolean;
    pinnedByDefault: boolean;
  };

  if (!selectedTemplate || !selectedTemplate[0]) {
    context.ui.showToast('Please select a template to edit');
    return;
  }

  const comments = await CommentStorage.getComments(context);
  const commentIndex = comments.findIndex(c => c.id === selectedTemplate[0]);

  if (commentIndex !== -1) {
    comments[commentIndex] = {
      id: selectedTemplate[0],
      title: title,
      comment: comment,
      flairs: Array.isArray(selectedFlairs) ? selectedFlairs : [],
      displayOnAllPosts: displayOnAllPosts || false,
      pinnedByDefault: pinnedByDefault || false
    };

    await CommentStorage.saveComments(context, comments);
    context.ui.showToast(`Comment template "${title}" updated successfully!`);
  } else {
    context.ui.showToast('Error: Comment not found');
  }
}

export async function handleDeleteComment(
  event: FormOnSubmitEvent<JSONObject>,
  context: Devvit.Context
): Promise<void> {
  const { selectedTemplate } = event.values as { selectedTemplate: string[] };

  if (!selectedTemplate || !selectedTemplate[0]) {
    context.ui.showToast('Please select a template to delete');
    return;
  }

  const commentToDelete = await CommentStorage.findCommentById(context, selectedTemplate[0]);
  
  if (!commentToDelete) {
    context.ui.showToast('Error: No comment found with the selected ID');
    return;
  }

  const deleted = await CommentStorage.deleteComment(context, selectedTemplate[0]);
  
  if (deleted) {
    context.ui.showToast(`Comment template "${commentToDelete.title}" deleted successfully!`);
  } else {
    context.ui.showToast('Error: Comment not found');
  }
}