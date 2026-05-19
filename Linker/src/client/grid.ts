import { ApiEndpoint, type Cell, type Page } from "../shared/api.ts";
import { apiDelete } from "./api.ts";
import { appEl, editToggleBtn, editToolbarEl, showEmpty } from "./dom.ts";
import { currentPage, newCell, newId } from "./helpers.ts";
import { showConfirmDialog } from "./modals.ts";
import { renderPage } from "./render.ts";
import { state } from "./state.ts";

export function addRow(): void {
  if (!state) return;
  const page = currentPage();
  if (!page) return;
  for (let i = 0; i < page.columns; i++) {
    const cell = newCell();
    state.boardState.cells[cell.id] = cell;
    page.cellIds.push(cell.id);
  }
  state.isDirty = true;
  renderPage();
}

export function removeRow(): void {
  if (!state) return;
  const page = currentPage();
  if (!page || page.cellIds.length <= page.columns) return;
  const removed = page.cellIds.splice(page.cellIds.length - page.columns, page.columns);
  for (const id of removed) {
    delete state.boardState.cells[id];
  }
  state.isDirty = true;
  renderPage();
}

export function insertRowBefore(rowIndex: number): void {
  if (!state) return;
  const page = currentPage();
  if (!page) return;
  const newCells = Array.from({ length: page.columns }, () => newCell());
  for (const cell of newCells) state.boardState.cells[cell.id] = cell;
  page.cellIds.splice(rowIndex * page.columns, 0, ...newCells.map((c) => c.id));
  state.isDirty = true;
  renderPage();
}

export function removeRowAt(rowIndex: number): void {
  if (!state) return;
  const page = currentPage();
  if (!page || page.cellIds.length <= page.columns) return;
  const removed = page.cellIds.splice(rowIndex * page.columns, page.columns);
  for (const id of removed) delete state.boardState.cells[id];
  state.isDirty = true;
  renderPage();
}

export function insertRowAfter(rowIndex: number): void {
  if (!state) return;
  const page = currentPage();
  if (!page) return;
  const newCells = Array.from({ length: page.columns }, () => newCell());
  for (const cell of newCells) state.boardState.cells[cell.id] = cell;
  page.cellIds.splice((rowIndex + 1) * page.columns, 0, ...newCells.map((c) => c.id));
  state.isDirty = true;
  renderPage();
}

export function insertColumnBefore(colIndex: number): void {
  if (!state) return;
  const page = currentPage();
  if (!page) return;
  const oldCols = page.columns;
  const numRows = Math.ceil(page.cellIds.length / oldCols);
  const newCellIds: string[] = [];
  for (let row = 0; row < numRows; row++) {
    const rowCells = page.cellIds.slice(row * oldCols, (row + 1) * oldCols);
    const cell = newCell();
    state.boardState.cells[cell.id] = cell;
    rowCells.splice(colIndex, 0, cell.id);
    newCellIds.push(...rowCells);
  }
  page.cellIds = newCellIds;
  page.columns = oldCols + 1;
  state.isDirty = true;
  renderPage();
}

export function removeColumnAt(colIndex: number): void {
  if (!state) return;
  const page = currentPage();
  if (!page || page.columns <= 1) return;
  const oldCols = page.columns;
  const numRows = Math.ceil(page.cellIds.length / oldCols);
  const newCellIds: string[] = [];
  for (let row = 0; row < numRows; row++) {
    const rowCells = page.cellIds.slice(row * oldCols, (row + 1) * oldCols);
    const [removed] = rowCells.splice(colIndex, 1);
    if (removed) delete state.boardState.cells[removed];
    newCellIds.push(...rowCells);
  }
  page.cellIds = newCellIds;
  page.columns = oldCols - 1;
  state.isDirty = true;
  renderPage();
}

export function insertColumnAfter(colIndex: number): void {
  insertColumnBefore(colIndex + 1);
}

export function addColumn(): void {
  if (!state) return;
  const page = currentPage();
  if (!page) return;
  const oldCols = page.columns;
  const newCols = oldCols + 1;
  const numRows = Math.ceil(page.cellIds.length / oldCols);
  const newCellIds: string[] = [];
  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < oldCols; col++) {
      newCellIds.push(page.cellIds[row * oldCols + col] ?? "");
    }
    const cell = newCell();
    state.boardState.cells[cell.id] = cell;
    newCellIds.push(cell.id);
  }
  page.cellIds = newCellIds.filter((id) => id !== "");
  page.columns = newCols;
  state.isDirty = true;
  renderPage();
}

export function removeColumn(): void {
  if (!state) return;
  const page = currentPage();
  if (!page || page.columns <= 1) return;
  const oldCols = page.columns;
  const newCols = oldCols - 1;
  const numRows = Math.ceil(page.cellIds.length / oldCols);
  const newCellIds: string[] = [];
  const toRemove: string[] = [];
  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < oldCols; col++) {
      const id = page.cellIds[row * oldCols + col];
      if (!id) continue;
      if (col === oldCols - 1) {
        toRemove.push(id);
      } else {
        newCellIds.push(id);
      }
    }
  }
  for (const id of toRemove) {
    delete state.boardState.cells[id];
  }
  page.cellIds = newCellIds;
  page.columns = newCols;
  state.isDirty = true;
  renderPage();
}

export function addPage(position: "before" | "after"): void {
  if (!state) return;
  const cells: Cell[] = Array.from({ length: 16 }, () => newCell());
  const page: Page = {
    id: newId(),
    title: "New Page",
    backgroundColor: "#000000",
    foregroundColor: "#FFFFFF",
    backgroundImage: "",
    columns: 4,
    cellIds: cells.map((c) => c.id),
  };
  for (const cell of cells) {
    state.boardState.cells[cell.id] = cell;
  }
  state.boardState.pages[page.id] = page;
  const insertAt =
    position === "before"
      ? state.currentPageIndex
      : state.currentPageIndex + 1;
  state.boardState.board.pageIds.splice(insertAt, 0, page.id);
  if (position === "after") state.currentPageIndex++;
  state.isDirty = true;
  renderPage();
}

export function removePage(): void {
  if (!state) return;
  const { board } = state.boardState;
  if (board.pageIds.length <= 1) {
    alert("Cannot remove the only page.");
    return;
  }
  showConfirmDialog("Remove this page and all its cells?", () => {
    if (!state) return;
    const pageId = board.pageIds[state.currentPageIndex];
    if (!pageId) return;
    const page = state.boardState.pages[pageId];
    if (page) {
      for (const cellId of page.cellIds) {
        delete state.boardState.cells[cellId];
      }
    }
    delete state.boardState.pages[pageId];
    board.pageIds.splice(state.currentPageIndex, 1);
    state.currentPageIndex = Math.min(
      state.currentPageIndex,
      board.pageIds.length - 1,
    );
    state.isDirty = true;
    renderPage();
  });
}

export async function deleteBoard(): Promise<void> {
  try {
    await apiDelete<unknown>(ApiEndpoint.DeleteBoard);
    showEmpty("Board deleted.");
    appEl.classList.remove("edit-mode");
    editToolbarEl.classList.add("hidden");
    editToggleBtn.classList.add("hidden");
  } catch {
    alert("Failed to delete board.");
  }
}
