import { Devvit, FormOnSubmitEvent, JSONObject } from '@devvit/public-api';
import { CommentStorage } from '../storage/index.js';

export async function handleDeleteAnyComment(
  event: FormOnSubmitEvent<JSONObject>,
  context: Devvit.Context
): Promise<void> {
  const { selectedTemplate } = event.values as { selectedTemplate: string[] };

  if (!selectedTemplate || !selectedTemplate[0]) {
    context.ui.showToast('Please select a template to delete');
    return;
  }

  const templateValue = selectedTemplate[0];
  
  // Parse the template type and ID from the value (format: "type:id")
  const [templateType, templateId] = templateValue.split(':');

  if (!templateType || !templateId) {
    context.ui.showToast('Error: Invalid template selection');
    return;
  }

  try {
    if (templateType === 'flair') {
      // Handle flair-based comment deletion
      const commentToDelete = await CommentStorage.findCommentById(context, templateId);
      
      if (!commentToDelete) {
        context.ui.showToast('Error: No flair comment found with the selected ID');
        return;
      }

      const deleted = await CommentStorage.deleteComment(context, templateId);
      
      if (deleted) {
        context.ui.showToast(`Flair comment template "${commentToDelete.title}" deleted successfully!`);
      } else {
        context.ui.showToast('Error: Flair comment not found');
      }
    } else if (templateType === 'user') {
      // Handle user-based comment deletion
      const commentToDelete = await CommentStorage.findUserCommentById(context, templateId);
      
      if (!commentToDelete) {
        context.ui.showToast('Error: No user comment found with the selected ID');
        return;
      }

      const deleted = await CommentStorage.deleteUserComment(context, templateId);
      
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
    } else {
      context.ui.showToast('Error: Unknown template type');
    }
  } catch (error) {
    context.ui.showToast(`An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}