import { navigateTo } from "@devvit/web/client";
import { ApiEndpoint, type ClickRequest, type SaveRequest } from "../shared/api.ts";
import { apiPost } from "./api.ts";
import { editToggleBtn, gridEl, nextBtn, prevBtn } from "./dom.ts";
import { openCellForm } from "./forms.ts";
import { getActiveLinks } from "./helpers.ts";
import { showInfoPopup } from "./modals.ts";
import { renderPage } from "./render.ts";
import { state } from "./state.ts";
import { addCellVariant, deleteCellVariant, rotateCellVariant } from "./variants.ts";
import { insertColumnAfter, insertColumnBefore, removeColumnAt, insertRowAfter, insertRowBefore, removeRowAt } from "./grid.ts";

export function setupGridEvents(): void {
  gridEl.addEventListener("click", (e: Event) => {
    if (!state) return;
    const target = e.target as HTMLElement;

    const colActionBtn = target.closest(".col-action-btn") as HTMLElement | null;
    if (colActionBtn && state.isEditMode) {
      e.stopPropagation();
      const colActionsEl = colActionBtn.closest(".col-actions") as HTMLElement | null;
      const colIndex = parseInt(colActionsEl?.dataset.col ?? "0");
      if (colActionBtn.dataset.action === "col-add-before") insertColumnBefore(colIndex);
      else if (colActionBtn.dataset.action === "col-remove") removeColumnAt(colIndex);
      else if (colActionBtn.dataset.action === "col-add-after") insertColumnAfter(colIndex);
      return;
    }

    const rowActionBtn = target.closest(".row-action-btn") as HTMLElement | null;
    if (rowActionBtn && state.isEditMode) {
      e.stopPropagation();
      const rowActionsEl = rowActionBtn.closest(".row-actions") as HTMLElement | null;
      const rowIndex = parseInt(rowActionsEl?.dataset.row ?? "0");
      if (rowActionBtn.dataset.action === "row-add-before") insertRowBefore(rowIndex);
      else if (rowActionBtn.dataset.action === "row-remove") removeRowAt(rowIndex);
      else if (rowActionBtn.dataset.action === "row-add-after") insertRowAfter(rowIndex);
      return;
    }

    const cellEl = target.closest(".cell") as HTMLElement | null;
    if (!cellEl) return;

    const cellId = cellEl.dataset.cellId;
    const action = (target.closest("[data-action]") as HTMLElement | null)?.dataset.action;

    if (!cellId) return;

    const cell = state.boardState.cells[cellId];

    if (state.isEditMode) {
      if (action === "rotate") {
        e.stopPropagation();
        rotateCellVariant(cellId);
      } else if (action === "add-variant") {
        e.stopPropagation();
        addCellVariant(cellId);
      } else if (action === "del-variant") {
        e.stopPropagation();
        deleteCellVariant(cellId);
      } else {
        const activeLinks = cell ? getActiveLinks(cell) : [];
        const linkIdx = cell ? cell.currentEditingIndex : 0;
        openCellForm(cellId, Math.min(linkIdx, activeLinks.length > 0 ? activeLinks.length - 1 : 0));
      }
    } else {
      if (action === "info") {
        e.stopPropagation();
        const desc = (target.closest("[data-action='info']") as HTMLElement)?.dataset.description ?? "";
        showInfoPopup(desc);
      } else {
        const uri = cellEl.dataset.uri ?? "";
        const linkId = cellEl.dataset.linkId ?? "";
        if (uri && linkId) {
          handleCellClick(cellId, linkId, uri);
        }
      }
    }
  });
}

export function setupNavigation(): void {
  prevBtn.addEventListener("click", () => {
    if (!state || state.currentPageIndex === 0) return;
    state.currentPageIndex--;
    state.variantSelections.clear();
    renderPage();
  });

  nextBtn.addEventListener("click", () => {
    if (!state) return;
    const total = state.boardState.board.pageIds.length;
    if (state.currentPageIndex >= total - 1) return;
    state.currentPageIndex++;
    state.variantSelections.clear();
    renderPage();
  });
}

export function setupEditToggle(): void {
  editToggleBtn.addEventListener("click", () => {
    if (!state) return;
    if (state.isEditMode) {
      exitEditMode();
    } else {
      state.isEditMode = true;
      editToggleBtn.classList.add("active");
      editToggleBtn.innerHTML = "&#10003;";
      editToggleBtn.title = "Save and exit edit mode";
      renderPage();
    }
  });
}

export function handleCellClick(cellId: string, linkId: string, uri: string): void {
  apiPost<unknown>(ApiEndpoint.Click, {
    cellId,
    linkId,
  } satisfies ClickRequest).catch(() => undefined);
  navigateTo(uri);
}

export async function exitEditMode(): Promise<void> {
  if (!state) return;
  if (state.isDirty) {
    try {
      await apiPost<unknown>(ApiEndpoint.Save, {
        boardState: state.boardState,
      } satisfies SaveRequest);
    } catch {
      alert("Failed to save changes. Please try again.");
      return;
    }
    state.isDirty = false;
  }
  state.isEditMode = false;
  state.variantSelections.clear();
  editToggleBtn.classList.remove("active");
  editToggleBtn.innerHTML = "&#9998;";
  editToggleBtn.title = "Edit board";
  renderPage();
}
