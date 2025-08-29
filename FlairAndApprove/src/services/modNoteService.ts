import { Devvit } from '@devvit/public-api';

export class ModNoteService {
  static async addApprovalNote(
    context: Devvit.Context,
    username: string,
    subredditName: string,
    isBulkApproval: boolean = false
  ): Promise<void> {
    try {
      const currentUser = await context.reddit.getCurrentUser();
      const moderatorName = currentUser?.username || 'Unknown';
      const approvalType = isBulkApproval ? 'Bulk Approval' : 'Manual Approval';
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      
      const noteText = `User approved via Approve & Flair tool\n\n` +
                      `Type: ${approvalType}\n\n` +
                      `Moderator: ${moderatorName}\n\n` +
                      `Date: ${timestamp}`;

      await context.reddit.addModNote({
        subreddit: subredditName,
        user: username,
        note: noteText,
        label: 'HELPFUL_USER', // You can change this to another appropriate label
        redditId: undefined // Will be auto-generated
      });

    } catch (error) {
      // Log error but don't fail the approval process
      console.error(`Failed to add mod note for ${username}:`, error);
    }
  }
}