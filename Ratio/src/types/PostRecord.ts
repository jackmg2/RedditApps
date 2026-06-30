export interface PostRecord {
  authorName: string;
  date: string;
  postTitle: string;
  postLink: string;
  ratio: string;
  /** Unix ms; optional because records written before the events migration lack it. */
  timestamp?: number;
}
