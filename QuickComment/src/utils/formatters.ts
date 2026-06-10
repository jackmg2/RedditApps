import type { Comment, UserComment } from '../types/index.js';
import { CommentStorage } from '../storage/index.js';
import { getSubredditFlairs } from './reddit.js';

export async function formatAllComments(subredditName: string): Promise<string> {
  const [comments, userComments, flairs] = await Promise.all([
    CommentStorage.getComments(),
    CommentStorage.getUserComments(),
    getSubredditFlairs(subredditName),
  ]);

  if (comments.length === 0 && userComments.length === 0) {
    return 'No comment templates found.';
  }

  const flairMap = new Map(flairs.map((f) => [f.id, f.text]));
  const separator = '\n---\n\n';
  let result = '';

  if (userComments.length > 0) {
    result += '=== USER-BASED COMMENTS ===\n\n';
    result += userComments
      .map((c) => {
        const pinned = c.pinnedByDefault ? 'Yes' : 'No';
        const enabled = c.enabled !== false ? 'Yes' : 'No';
        return `Title: ${c.title}\nUsername: u/${c.username}\nComment: ${c.comment}\nPinned by default: ${pinned}\nEnabled: ${enabled}\n`;
      })
      .join(separator);
    result += '\n';
  }

  if (comments.length > 0) {
    result += '=== FLAIR-BASED COMMENTS ===\n\n';
    result += comments
      .map((c) => {
        const flairNames =
          c.flairs.length > 0 ? c.flairs.map((id) => flairMap.get(id) || id).join(';') : '';
        const displayOnAll = c.displayOnAllPosts ? 'Yes' : 'No';
        const pinned = c.pinnedByDefault ? 'Yes' : 'No';
        const enabled = c.enabled !== false ? 'Yes' : 'No';
        return `Title: ${c.title}\nComment: ${c.comment}\nFlairs: ${flairNames}\nDisplay on all posts: ${displayOnAll}\nPinned by default: ${pinned}\nEnabled: ${enabled}\n`;
      })
      .join(separator);
  }

  return result;
}

export function formatCommentOption(c: Comment): string {
  const flairInfo = c.flairs.length > 0 ? c.flairs.join(', ') : 'None';
  return `${c.title} (Flairs: ${flairInfo})${c.displayOnAllPosts ? ' [All Posts]' : ''}${c.pinnedByDefault ? ' [Pinned]' : ''}${c.enabled === false ? ' [Disabled]' : ''}`;
}

export function formatUserCommentOption(c: UserComment): string {
  return `${c.title} (u/${c.username})${c.pinnedByDefault ? ' [Pinned]' : ''}${c.enabled === false ? ' [Disabled]' : ''}`;
}

export function formatUnifiedCommentOption(c: Comment | UserComment, type: 'flair' | 'user'): string {
  if (type === 'user') {
    const uc = c as UserComment;
    return `[User] ${uc.title} (u/${uc.username})${uc.pinnedByDefault ? ' [Pinned]' : ''}${uc.enabled === false ? ' [Disabled]' : ''}`;
  }
  const fc = c as Comment;
  const flairInfo = fc.flairs.length > 0 ? fc.flairs.join(', ') : 'None';
  return `[Flair] ${fc.title} (Flairs: ${flairInfo})${fc.displayOnAllPosts ? ' [All Posts]' : ''}${fc.pinnedByDefault ? ' [Pinned]' : ''}${fc.enabled === false ? ' [Disabled]' : ''}`;
}
