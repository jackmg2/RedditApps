import { getActiveLinks, newLink } from "./helpers.ts";
import { openCellForm } from "./forms.ts";
import { renderPage } from "./render.ts";
import { state } from "./state.ts";

export function rotateCellVariant(cellId: string): void {
  if (!state) return;
  const cell = state.boardState.cells[cellId];
  if (!cell) return;
  const count = cell.links.length;
  cell.currentEditingIndex = (cell.currentEditingIndex + 1) % count;
  state.isDirty = true;
  renderPage();
}

export function addCellVariant(cellId: string): void {
  if (!state) return;
  const cell = state.boardState.cells[cellId];
  if (!cell) return;
  const newL = newLink();
  cell.links.push(newL);
  cell.weights.push(1);
  cell.currentEditingIndex = cell.links.length - 1;
  const activeLinks = getActiveLinks(cell);
  cell.rotationEnabled = activeLinks.length >= 2;
  state.isDirty = true;
  openCellForm(cellId, cell.currentEditingIndex);
}

export function deleteCellVariant(cellId: string): void {
  if (!state) return;
  const cell = state.boardState.cells[cellId];
  if (!cell) return;

  const idx = cell.currentEditingIndex;
  if (cell.links.length <= 1) {
    cell.links[0] = newLink();
    cell.weights[0] = 1;
    cell.rotationEnabled = false;
    cell.currentEditingIndex = 0;
  } else {
    cell.links.splice(idx, 1);
    cell.weights.splice(idx, 1);
    cell.currentEditingIndex = Math.min(idx, cell.links.length - 1);
    const activeLinks = getActiveLinks(cell);
    cell.rotationEnabled = activeLinks.length >= 2;
  }
  state.isDirty = true;
  renderPage();
}
