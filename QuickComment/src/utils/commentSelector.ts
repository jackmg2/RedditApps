import { Context } from '@devvit/public-api';
import { Comment, UserComment, CommentSelection } from '../types/index.js';
import { CommentStorage } from '../storage/index.js';

export class CommentSelector {
  constructor(private context: Context) {}

  async selectComment(post: any): Promise<CommentSelection> {
    const comments = await CommentStorage.getComments(this.context);
    const userComments = await CommentStorage.getUserComments(this.context);
    
    let selectedComment: Comment | null = null;
    let selectedUserComment: UserComment | null = null;
    
    const postFlairId = post?.linkFlair?.templateId;
    const user = await this.context.reddit.getUserById(post.authorId as string);
    const postAuthor = user?.username;

    // First, check for user-based comments
    if (postAuthor) {
      selectedUserComment = userComments.find(c =>
        c.username.toLowerCase() === postAuthor.toLowerCase()
      ) || null;
    }

    // Then, check for flair-based comments
    if (postFlairId) {
      selectedComment = this.selectFlairComment(comments, postFlairId);
    }

    // If no flair-based comment, check for "all posts" comments
    if (!selectedComment) {
      selectedComment = this.selectAllPostsComment(comments);
    }

    // Construct the final comment
    return this.constructFinalComment(selectedUserComment, selectedComment);
  }

  private selectFlairComment(comments: Comment[], postFlairId: string): Comment | null {
    // Priority 1: Comments with exactly 1 flair that matches the post flair
    const singleFlairComments = comments.filter(c =>
      c.flairs.length === 1 &&
      c.flairs[0] === postFlairId &&
      !c.displayOnAllPosts
    );

    if (singleFlairComments.length > 0) {
      return singleFlairComments[0];
    }

    // Priority 2: Comments with multiple flairs that include the post flair
    const multipleFlairComments = comments.filter(c =>
      c.flairs.length > 1 &&
      c.flairs.includes(postFlairId) &&
      !c.displayOnAllPosts
    );

    if (multipleFlairComments.length > 0) {
      return multipleFlairComments[0];
    }

    return null;
  }

  private selectAllPostsComment(comments: Comment[]): Comment | null {
    const allPostsComments = comments.filter(c => c.displayOnAllPosts);
    return allPostsComments.length > 0 ? allPostsComments[0] : null;
  }

  private constructFinalComment(
    userComment: UserComment | null,
    flairComment: Comment | null
  ): CommentSelection {
    let commentText = '';
    let shouldPin = false;

    if (userComment) {
      commentText = userComment.comment;
      shouldPin = userComment.pinnedByDefault;

      // If there's also a flair/general comment, add it after a separator
      if (flairComment) {
        commentText += '\n\n---\n\n' + flairComment.comment;
        // If either comment should be pinned, pin the combined comment
        shouldPin = shouldPin || flairComment.pinnedByDefault;
      }
    } else if (flairComment) {
      commentText = flairComment.comment;
      shouldPin = flairComment.pinnedByDefault;
    }

    return { commentText, shouldPin };
  }
}