import { reddit } from '@devvit/web/server';

export async function addApprovalNote(
  username: string,
  subredditName: string,
  isBulk: boolean
): Promise<void> {
  try {
    const currentUser = await reddit.getCurrentUser();
    const moderatorName = currentUser?.username ?? 'Unknown';
    const approvalType = isBulk ? 'Bulk' : 'Manual';
    const timestamp = new Date().toISOString();

    const note =
      `User approved via Approve & Flair tool\n\n` +
      `Type: ${approvalType}\n\n` +
      `Moderator: ${moderatorName}\n\n` +
      `Date: ${timestamp}`;

    await reddit.addModNote({
      subreddit: subredditName,
      user: username,
      note,
      label: 'HELPFUL_USER',
    });
  } catch (error) {
    console.error(`Failed to add mod note for ${username}:`, error);
  }
}
