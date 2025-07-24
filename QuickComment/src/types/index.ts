export interface Comment {
  id: string;
  title: string;
  comment: string;
  flairs: string[];
  displayOnAllPosts: boolean;
  pinnedByDefault: boolean;
}

export interface UserComment {
  id: string;
  title: string;
  comment: string;
  username: string;
  pinnedByDefault: boolean;
}

export interface PostFlair {
  id: string;
  text: string;
}

export interface CommentFormData {
  postId?: string;
  predefinedComments?: Array<{ label: string; value: string }>;
  defaultValuePinComment?: boolean;
  comments?: Comment[];
  userComments?: UserComment[];
  flairs?: Array<{ label: string; value: string }>;
  formattedComments?: string;
}

export interface CommentSelection {
  commentText: string;
  shouldPin: boolean;
}