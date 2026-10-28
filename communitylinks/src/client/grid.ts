import { ApiEndpoint, type Cell, type Page, type PageType } from "../shared/api.ts";
import { apiDelete } from "./api.ts";
import { appEl, editToggleBtn, editToolbarEl, showEmpty } from "./dom.ts";
import { clearCell, currentPage, getActiveLinks, newCell, newId, setCellSpan } from "./helpers.ts";
import { computeLayout, slotsIn } from "./layout.ts";
import { showAddPageDialog, showConfirmDialog } from "./modals.ts";
import { renderPage } from "./render.ts";
import { state } from "./state.ts";

export function insertRowBefore(rowIndex: number): void {
  if (!state) return;
  const page = currentPage();
  if (!page) return;
  const { cells } = state.boardState;
  // A merged cell straddling the insertion line stretches over the new row.
  for (const p of computeLayout(page, cells).placements) {
    if (p.row < rowIndex && p.row + p.rowSpan > rowIndex) {
      setCellSpan(cells[p.cellId]!, p.rowSpan + 1, p.colSpan);
    }
  }
  const newCells = Array.from({ length: page.columns }, () => newCell());
  for (const cell of newCells) cells[cell.id] = cell;
  page.cellIds.splice(rowIndex * page.columns, 0, ...newCells.map((c) => c.id));
  state.isDirty = true;
  renderPage();
}

export function removeRowAt(rowIndex: number): void {
  if (!state) return;
  const page = currentPage();
  if (!page || page.cellIds.length <= page.columns) return;
  const { cells } = state.boardState;
  for (const p of computeLayout(page, cells).placements) {
    if (p.row < rowIndex && p.row + p.rowSpan > rowIndex) {
      setCellSpan(cells[p.cellId]!, p.rowSpan - 1, p.colSpan);
    } else if (p.row === rowIndex && p.rowSpan > 1) {
      // Move the merged cell down onto its (empty) covered slot so it survives.
      const below = p.index + page.columns;
      [page.cellIds[p.index], page.cellIds[below]] = [page.cellIds[below]!, p.cellId];
      setCellSpan(cells[p.cellId]!, p.rowSpan - 1, p.colSpan);
    }
  }
  const removed = page.cellIds.splice(rowIndex * page.columns, page.columns);
  for (const id of removed) delete cells[id];
  state.isDirty = true;
  renderPage();
}

export function insertRowAfter(rowIndex: number): void {
  insertRowBefore(rowIndex + 1);
}

export function insertColumnBefore(colIndex: number): void {
  if (!state) return;
  const page = currentPage();
  if (!page) return;
  const { cells } = state.boardState;
  for (const p of computeLayout(page, cells).placements) {
    if (p.col < colIndex && p.col + p.colSpan > colIndex) {
      setCellSpan(cells[p.cellId]!, p.rowSpan, p.colSpan + 1);
    }
  }
  const oldCols = page.columns;
  const numRows = Math.ceil(page.cellIds.length / oldCols);
  const newCellIds: string[] = [];
  for (let row = 0; row < numRows; row++) {
    const rowCells = page.cellIds.slice(row * oldCols, (row + 1) * oldCols);
    const cell = newCell();
    cells[cell.id] = cell;
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
  const { cells } = state.boardState;
  for (const p of computeLayout(page, cells).placements) {
    if (p.col < colIndex && p.col + p.colSpan > colIndex) {
      setCellSpan(cells[p.cellId]!, p.rowSpan, p.colSpan - 1);
    } else if (p.col === colIndex && p.colSpan > 1) {
      // Move the merged cell right onto its (empty) covered slot so it survives.
      const right = p.index + 1;
      [page.cellIds[p.index], page.cellIds[right]] = [page.cellIds[right]!, p.cellId];
      setCellSpan(cells[p.cellId]!, p.rowSpan, p.colSpan - 1);
    }
  }
  const oldCols = page.columns;
  const numRows = Math.ceil(page.cellIds.length / oldCols);
  const newCellIds: string[] = [];
  for (let row = 0; row < numRows; row++) {
    const rowCells = page.cellIds.slice(row * oldCols, (row + 1) * oldCols);
    const [removed] = rowCells.splice(colIndex, 1);
    if (removed) delete cells[removed];
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

// Sets how many rows/columns a cell spans. Cells it grows over are cleared
// (after confirmation when they hold links); shrinking reveals empty cells.
export function resizeCell(cellId: string, rowSpan: number, colSpan: number): void {
  if (!state) return;
  const page = currentPage();
  if (!page) return;
  const { cells } = state.boardState;
  const cell = cells[cellId];
  const layout = computeLayout(page, cells);
  const placement = layout.placements.find((p) => p.cellId === cellId);
  if (!cell || !placement) return;

  const newRowSpan = Math.max(1, Math.min(rowSpan, layout.rows - placement.row));
  const newColSpan = Math.max(1, Math.min(colSpan, page.columns - placement.col));
  if (newRowSpan === placement.rowSpan && newColSpan === placement.colSpan) return;

  // Every other cell in the new area, plus merged cells reaching into it.
  const victimIds = new Set<string>();
  for (const i of slotsIn(page, placement.row, placement.col, newRowSpan, newColSpan)) {
    const id = page.cellIds[i];
    if (id) victimIds.add(id);
    const anchor = layout.coveredBy.get(i);
    if (anchor) victimIds.add(anchor);
  }
  victimIds.delete(cellId);
  const victims = [...victimIds]
    .map((id) => cells[id])
    .filter((c): c is Cell => !!c);

  const apply = () => {
    if (!state) return;
    for (const victim of victims) clearCell(victim);
    setCellSpan(cell, newRowSpan, newColSpan);
    state.isDirty = true;
    renderPage();
  };

  const lostLinks = victims.reduce((sum, c) => sum + getActiveLinks(c).length, 0);
  if (lostLinks > 0) {
    showConfirmDialog(
      `This will delete ${lostLinks} link${lostLinks > 1 ? "s" : ""} in the cells it covers.`,
      apply,
    );
  } else {
    apply();
  }
}

export function addPage(position: "before" | "after"): void {
  showAddPageDialog((title, type) => createPage(position, title, type));
}

function createPage(
  position: "before" | "after",
  title: string,
  type: PageType,
): void {
  if (!state) return;
  const cells: Cell[] =
    type === "grid" ? Array.from({ length: 16 }, () => newCell()) : [];
  const page: Page = {
    id: newId(),
    title,
    backgroundColor: "#000000",
    foregroundColor: "#FFFFFF",
    backgroundImage: "",
    columns: type === "grid" ? 4 : 1,
    cellIds: cells.map((c) => c.id),
    type,
    ...(type === "calendar" ? { events: {} } : {}),
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
  showConfirmDialog("Remove this page and all its content?", () => {
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
    editToggleBtn.classList.add("hidden");
    editToolbarEl.classList.add("hidden");
  } catch {
    alert("Failed to delete board.");
  }
}
