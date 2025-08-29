export interface AppSettings {
  defaultComment: string;
  defaultValueApproveUser: boolean;
  defaultValueApprovePost: boolean;
  defaultValueApproveComment: boolean;
  autoAddModNote: boolean;
}

export interface ApprovalFormData {
  username: string;
  subRedditName: string;
  postId?: string;
  commentId?: string;
  flairTemplates: { label: string; value: string }[];
  defaultFlair: string[];
  defaultComment: string;
  defaultValueApproveUser: boolean;
  defaultValueApprovePost: boolean;
  defaultValueApproveComment: boolean;
}