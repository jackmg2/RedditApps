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
      selectedUserComment = this.selectUserComment(userComments, postAuthor);
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

  private selectUserComment(userComments: UserComment[], postAuthor: string): UserComment | null {
    const matchingComments = userComments.filter(c =>
      c.username.toLowerCase() === postAuthor.toLowerCase()
    );

    if (matchingComments.length === 0) {
      return null;
    }

    // If multiple comments for the same user, pick one randomly
    return this.getRandomElement(matchingComments);
  }

  private selectFlairComment(comments: Comment[], postFlairId: string): Comment | null {
    // Priority 1: Comments with exactly 1 flair that matches the post flair
    const singleFlairComments = comments.filter(c =>
      c.flairs.length === 1 &&
      c.flairs[0] === postFlairId &&
      !c.displayOnAllPosts
    );

    if (singleFlairComments.length > 0) {
      return this.getRandomElement(singleFlairComments);
    }

    // Priority 2: Comments with multiple flairs that include the post flair
    const multipleFlairComments = comments.filter(c =>
      c.flairs.length > 1 &&
      c.flairs.includes(postFlairId) &&
      !c.displayOnAllPosts
    );

    if (multipleFlairComments.length > 0) {
      return this.getRandomElement(multipleFlairComments);
    }

    return null;
  }

  private selectAllPostsComment(comments: Comment[]): Comment | null {
    const allPostsComments = comments.filter(c => c.displayOnAllPosts);
    
    if (allPostsComments.length === 0) {
      return null;
    }

    return this.getRandomElement(allPostsComments);
  }

  private getRandomElement<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot select random element from empty array');
    }
    const randomIndex = Math.floor(Math.random() * array.length);
    return array[randomIndex];
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