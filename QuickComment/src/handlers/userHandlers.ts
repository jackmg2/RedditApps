import { Devvit, FormOnSubmitEvent, JSONObject } from '@devvit/public-api';
import { UserComment } from '../types/index.js';
import { CommentStorage } from '../storage/index.js';
import { cleanUsername } from '../utils/validators.js';

export async function handleCreateUserComment(
  event: FormOnSubmitEvent<JSONObject>,
  context: Devvit.Context
): Promise<void> {
  const { title, comment, username, pinnedByDefault } = event.values;

  const cleanedUsername = cleanUsername(username as string);

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

  // Check if this is an additional comment for an existing user
  const existingCommentsCount = userComments.filter(c => 
    c.username.toLowerCase() === cleanedUsername.toLowerCase()
  ).length;

  const message = existingCommentsCount > 1 
    ? `User comment template for u/${cleanedUsername} created successfully! (${existingCommentsCount} total comments for this user)`
    : `User comment template for u/${cleanedUsername} created successfully!`;

  context.ui.showToast(message);
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
    // Check remaining comments for this user
    const remainingUserComments = await CommentStorage.getUserComments(context);
    const remainingForUser = remainingUserComments.filter(c => 
      c.username.toLowerCase() === commentToDelete.username.toLowerCase()
    ).length;

    const message = remainingForUser > 0
      ? `User comment template "${commentToDelete.title}" deleted successfully! (${remainingForUser} remaining for u/${commentToDelete.username})`
      : `User comment template "${commentToDelete.title}" deleted successfully!`;

    context.ui.showToast(message);
  } else {
    context.ui.showToast('Error: User comment not found');
  }
}