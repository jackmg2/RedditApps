export interface AppSettings {
  defaultBanDuration?: string;
  defaultRemoveContent?: string;
  showLockOption?: boolean;
  defaultLockPosts?: boolean;
  showMuteOption?: boolean;
  defaultMuteUser?: boolean;
  /** Template for the message sent to the banned user. Supports {rule} and {ruleMessage}. */
  defaultBanMessage?: string;
  /** Show the ban message field in the forms. When hidden, the default message is sent. */
  showMessageField?: boolean;
  /** Template for the mod-only note. Supports {rule} and {ruleMessage}. */
  defaultBanNote?: string;
  /** Show the mod note field in the forms. When hidden, the default note is used. */
  showNoteField?: boolean;
}
