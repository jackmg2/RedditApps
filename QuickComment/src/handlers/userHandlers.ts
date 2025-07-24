import { Devvit, FormOnSubmitEvent, JSONObject } from '@devvit/public-api';
import { UserComment } from '../types/index.js';
import { CommentStorage } from '../storage/index.js';
import { cleanUsername, isUsernameAvailable } from '../utils/validators.js';

export async function handleCreateUserComment(
  event: FormOnSubmitEvent<JSONObject>,
  context: Devvit.Context
): Promise<void> {
  const { title, comment, username, pinnedByDefault } = event.values;

  const cleanedUsername = cleanUsername(username as string);

  // Check if username already exists
  if (!await isUsernameAvailable(context, cleanedUsername)) {
    context.ui.showToast(`A comment template for u/${cleanedUsername} already exists. Use Edit to modify it.`);
    return;
  }

  const userComments = await CommentStorage.getUserComments(context);
  const newUserComment: UserComment = {
    id: await CommentStorage.getNextUserId(context),
    title: title as string,
    comment: comment as string,
    username: cleanedUsername,
    pinnedByDefault: pinnedByDefault as boolean || false
  };

  userComments.push(newUserComment);
  await CommentStorage.saveUserComments(context, userComments);

  context.ui.showToast(`User comment template for u/${cleanedUsername} created successfully!`);
}

export async function handleEditUserComment(
  event: FormOnSubmitEvent<JSONObject>,
  context: Devvit.Context
): Promise<void> {
  const { selectedTemplate, title, username, comment, pinnedByDefault } = event.values as {
    selectedTemplate: string[];
    title: string;
    username: string;
    comment: string;
    pinnedByDefault: boolean;
  };

  if (!selectedTemplate || !selectedTemplate[0]) {
    context.ui.showToast('Please select a user template to edit');
    return;
  }

  const cleanedUsername = cleanUsername(username);

  // Check if username already exists (but allow editing the same one)
  if (!await isUsernameAvailable(context, cleanedUsername, selectedTemplate[0])) {
    context.ui.showToast(`A comment template for u/${cleanedUsername} already exists.`);
    return;
  }

  const userComments = await CommentStorage.getUserComments(context);
  const commentIndex = userComments.findIndex(c => c.id === selectedTemplate[0]);

  if (commentIndex !== -1) {
    userComments[commentIndex] = {
      id: selectedTemplate[0],
      title: title,
      comment: comment,
      username: cleanedUsername,
      pinnedByDefault: pinnedByDefault || false
    };

    await CommentStorage.saveUserComments(context, userComments);
    context.ui.showToast(`User comment template "${title}" updated successfully!`);
  } else {
    context.ui.showToast('Error: User comment not found');
  }
}

export async function handleDeleteUserComment(
  event: FormOnSubmitEvent<JSONObject>,
  context: Devvit.Context
): Promise<void> {
  const { selectedTemplate } = event.values as { selectedTemplate: string[] };

  if (!selectedTemplate || !selectedTemplate[0]) {
    context.ui.showToast('Please select a user template to delete');
    return;
  }

  const commentToDelete = await CommentStorage.findUserCommentById(context, selectedTemplate[0]);
  
  if (!commentToDelete) {
    context.ui.showToast('Error: No user comment found with the selected ID');
    return;
  }

  const deleted = await CommentStorage.deleteUserComment(context, selectedTemplate[0]);
  
  if (deleted) {
    context.ui.showToast(`User comment template "${commentToDelete.title}" deleted successfully!`);
  } else {
    context.ui.showToast('Error: User comment not found');
  }
}