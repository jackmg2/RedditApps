import type { BoardState } from "../shared/api.ts";

export type AppState = {
  boardState: BoardState;
  currentPageIndex: number;
  isEditMode: boolean;
  username: string;
  isEditor: boolean;
  isModerator: boolean;
  isDirty: boolean;
  variantSelections: Map<string, number>;
};

export let state: AppState | null = null;

export function setState(s: AppState | null): void {
  state = s;
}
