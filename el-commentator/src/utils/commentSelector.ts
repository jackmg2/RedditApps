import type { Comment, UserComment, CommentSelection } from '../types/index.js';
import { CommentStorage } from '../storage/index.js';
import { filterPreferringPeriod, getPeriodStatus } from './validators.js';

export class CommentSelector {
  async selectComment(
    postAuthor: string | undefined,
    flairTemplateId: string | undefined
  ): Promise<CommentSelection> {
    const [comments, userComments] = await Promise.all([
      CommentStorage.getComments(),
      CommentStorage.getUserComments(),
    ]);

    let selectedComment: Comment | null = null;
    let selectedUserComment: UserComment | null = null;

    if (postAuthor) {
      selectedUserComment = this.selectUserComment(userComments, postAuthor);
    }

    if (flairTemplateId) {
      selectedComment = this.selectFlairComment(comments, flairTemplateId);
    }

    if (!selectedComment) {
      selectedComment = this.selectAllPostsComment(comments);
    }

    return this.constructFinalComment(selectedUserComment, selectedComment);
  }

  private isEligible(c: Comment | UserComment): boolean {
    return c.enabled !== false && getPeriodStatus(c) === 'active';
  }

  private selectUserComment(userComments: UserComment[], postAuthor: string): UserComment | null {
    const matches = userComments.filter(
      (c) => this.isEligible(c) && c.username.toLowerCase() === postAuthor.toLowerCase()
    );
    return matches.length > 0 ? this.randomElement(filterPreferringPeriod(matches)) : null;
  }

  private selectFlairComment(comments: Comment[], flairId: string): Comment | null {
    const single = comments.filter(
      (c) => this.isEligible(c) && c.flairs.length === 1 && c.flairs[0] === flairId && !c.displayOnAllPosts
    );
    if (single.length > 0) return this.randomElement(filterPreferringPeriod(single));

    const multi = comments.filter(
      (c) => this.isEligible(c) && c.flairs.length > 1 && c.flairs.includes(flairId) && !c.displayOnAllPosts
    );
    if (multi.length > 0) return this.randomElement(filterPreferringPeriod(multi));

    return null;
  }

  private selectAllPostsComment(comments: Comment[]): Comment | null {
    const all = comments.filter((c) => this.isEligible(c) && c.flairs.length === 0);
    return all.length > 0 ? this.randomElement(filterPreferringPeriod(all)) : null;
  }

  private randomElement<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]!;
  }

  private constructFinalComment(
    userComment: UserComment | null,
    flairComment: Comment | null
  ): CommentSelection {
    if (userComment && flairComment) {
      return {
        commentText: userComment.comment + '\n\n---\n\n' + flairComment.comment,
        shouldPin: userComment.pinnedByDefault || flairComment.pinnedByDefault,
      };
    }
    if (userComment) {
      return { commentText: userComment.comment, shouldPin: userComment.pinnedByDefault };
    }
    if (flairComment) {
      return { commentText: flairComment.comment, shouldPin: flairComment.pinnedByDefault };
    }
    return { commentText: '', shouldPin: false };
  }
}
