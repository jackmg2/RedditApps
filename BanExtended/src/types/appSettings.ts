export interface AppSettings {
  defaultBanDuration: string;
  defaultRemoveContent: string;
}

export interface BanFormData {
  username: string;
  subRedditName: string;
  subredditRules: { label: string; value: string }[];
  defaultBanDuration: string;
  defaultRemoveContent: string;
}