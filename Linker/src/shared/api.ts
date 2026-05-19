export type LinkVariant = {
  id: string;
  uri: string;
  title: string;
  image: string;
  textColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
  description: string;
  clickCount: number;
};

export type Cell = {
  id: string;
  displayName: string;
  rotationEnabled: boolean;
  impressionCount: number;
  variantImpressions: Record<string, number>;
  currentEditingIndex: number;
  links: LinkVariant[];
  weights: number[];
};

export type Page = {
  id: string;
  title: string;
  backgroundColor: string;
  foregroundColor: string;
  backgroundImage: string;
  columns: number;
  cellIds: string[];
};

export type Board = {
  id: string;
  postId: string;
  pageIds: string[];
};

export type BoardState = {
  board: Board;
  pages: Record<string, Page>;
  cells: Record<string, Cell>;
};

export type InitResponse = {
  type: "init";
  boardState: BoardState | null;
  username: string;
  isEditor: boolean;
  isModerator: boolean;
  needsMigration?: boolean;
};

export type MigrateResponse = {
  type: "migrate";
  boardState: BoardState;
};

export type SaveRequest = {
  boardState: BoardState;
};

export type SaveResponse = {
  type: "save";
};

export type ClickRequest = {
  cellId: string;
  linkId: string;
};

export type ClickResponse = {
  type: "click";
};

export type ImpressionRequest = {
  cellIds: string[];
};

export type ImpressionResponse = {
  type: "impression";
};

export type PageAnalytics = {
  pageId: string;
  title: string;
  totalClicks: number;
  totalImpressions: number;
  ctr: number;
  activeCellCount: number;
  topCells: { cellId: string; clicks: number }[];
  heatmapRows: number[];
  heatmapCols: number[];
};

export type ABVariantInfo = {
  linkId: string;
  title: string;
  impressions: number;
  clicks: number;
  ctr: number;
  weight: number;
  weightRatio: number;
  actualShare: number;
  isBest: boolean;
};

export type ABTestInfo = {
  cellId: string;
  variants: ABVariantInfo[];
  isSignificant: boolean;
};

export type AnalyticsData = {
  totalClicks: number;
  totalImpressions: number;
  ctr: number;
  mostClickedPageTitle: string;
  mostClickedCellId: string;
  activeABTests: number;
  pages: PageAnalytics[];
};

export type AnalyticsResponse = {
  type: "analytics";
  data: AnalyticsData;
  abTests: ABTestInfo[];
};

export type SettingsResponse = {
  type: "settings";
  editWhitelist: string;
};

export type SettingsUpdateRequest = {
  editWhitelist: string;
};

export type DeleteResponse = {
  type: "delete";
};

export type UploadImageRequest = { dataUrl: string };
export type UploadImageResponse = { mediaUrl: string };

export const ApiEndpoint = {
  Init: "/api/init",
  Save: "/api/save",
  Click: "/api/click",
  Impression: "/api/impression",
  Analytics: "/api/analytics",
  Settings: "/api/settings",
  DeleteBoard: "/api/board",
  UploadImage: "/api/upload-image",
  Migrate: "/api/migrate",
  OnPostCreate: "/internal/menu/post-create",
  OnAppInstall: "/internal/on-app-install",
} as const;

export type ApiEndpoint = (typeof ApiEndpoint)[keyof typeof ApiEndpoint];
