export interface Comment {
  id: string;
  title: string;
  comment: string;
  flairs: string[];
  pinnedByDefault: boolean;
  displayOnAllPosts?: boolean;
  enabled?: boolean;
  /** Inclusive start, "YYYY-MM-DD" or "YYYY-MM-DD HH:MM" (UTC). Absent = no start bound. */
  activeFrom?: string;
  /** Inclusive end, "YYYY-MM-DD" or "YYYY-MM-DD HH:MM" (UTC). Absent = no end bound. */
  activeUntil?: string;
}

export interface UserComment {
  id: string;
  title: string;
  comment: string;
  username: string;
  pinnedByDefault: boolean;
  enabled?: boolean;
  /** Inclusive start, "YYYY-MM-DD" or "YYYY-MM-DD HH:MM" (UTC). Absent = no start bound. */
  activeFrom?: string;
  /** Inclusive end, "YYYY-MM-DD" or "YYYY-MM-DD HH:MM" (UTC). Absent = no end bound. */
  activeUntil?: string;
}

export interface PostFlair {
  id: string;
  text: string;
}

export interface CommentSelection {
  commentText: string;
  shouldPin: boolean;
}
