import { Devvit } from '@devvit/public-api';
import { Comment, UserComment, PostFlair } from '../types/index.js';
import { CommentStorage } from '../storage/index.js';
import { getSubredditFlairs } from './reddit.js';

export async function formatAllComments(context: Devvit.Context): Promise<string> {
  const comments = await CommentStorage.getComments(context);
  const userComments = await CommentStorage.getUserComments(context);
  const flairs = await getSubredditFlairs(context);
  const separator = '\n---\n\n';

  if (comments.length === 0 && userComments.length === 0) {
    return "No comment templates found.";
  }

  // Create a map of flair IDs to flair text for display
  const flairMap = new Map(flairs.map(f => [f.id, f.text]));

  let result = '';

  if (userComments.length > 0) {
    result += '=== USER-BASED COMMENTS ===\n\n';
    result += userComments.map(comment => {
      const pinnedByDefault = comment.pinnedByDefault ? 'Yes' : 'No';
      return `Title: ${comment.title}\nUsername: u/${comment.username}\nComment: ${comment.comment}\nPinned by default: ${pinnedByDefault}\n`;
    }).join(separator);
    result += '\n';
  }

  if (comments.length > 0) {
    result += '=== FLAIR-BASED COMMENTS ===\n\n';
    result += comments.map(comment => {
      const flairNames = comment.flairs.length > 0
        ? comment.flairs.map(flairId => flairMap.get(flairId) || flairId).join(';')
        : '';

      const displayOnAll = comment.displayOnAllPosts ? 'Yes' : 'No';
      const pinnedByDefault = comment.pinnedByDefault ? 'Yes' : 'No';

      return `Title: ${comment.title}\nComment: ${comment.comment}\nFlairs: ${flairNames}\nDisplay on all posts: ${displayOnAll}\nPinned by default: ${pinnedByDefault}\n`;
    }).join(separator);
  }

  return result;
}

export function formatCommentOption(comment: Comment): string {
  return `${comment.title} (Flairs: ${comment.flairs.length > 0 ? comment.flairs.join(', ') : 'None'}) ${comment.displayOnAllPosts ? '[All Posts]' : ''} ${comment.pinnedByDefault ? '[Pinned]' : ''}`;
}

export function formatUserCommentOption(comment: UserComment): string {
  return `${comment.title} (u/${comment.username}) ${comment.pinnedByDefault ? '[Pinned]' : ''}`;
}

export function formatUnifiedCommentOption(comment: Comment | UserComment, type: 'flair' | 'user'): string {
  if (type === 'user') {
    const userComment = comment as UserComment;
    return `[User] ${userComment.title} (u/${userComment.username}) ${userComment.pinnedByDefault ? '[Pinned]' : ''}`;
  } else {
    const flairComment = comment as Comment;
    const flairInfo = flairComment.flairs.length > 0 ? flairComment.flairs.join(', ') : 'None';
    return `[Flair] ${flairComment.title} (Flairs: ${flairInfo}) ${flairComment.displayOnAllPosts ? '[All Posts]' : ''} ${flairComment.pinnedByDefault ? '[Pinned]' : ''}`;
  }
}