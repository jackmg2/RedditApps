export interface Comment {
  id: string;
  title: string;
  comment: string;
  flairs: string[];
  pinnedByDefault: boolean;
  displayOnAllPosts?: boolean;
  enabled?: boolean;
}

export interface UserComment {
  id: string;
  title: string;
  comment: string;
  username: string;
  pinnedByDefault: boolean;
  enabled?: boolean;
}

export interface PostFlair {
  id: string;
  text: string;
}

export interface CommentSelection {
  commentText: string;
  shouldPin: boolean;
}
