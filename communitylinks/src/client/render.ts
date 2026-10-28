import { ApiEndpoint, type Cell, type ImpressionRequest } from "../shared/api.ts";
import { apiPost } from "./api.ts";
import { isCalendarPage, renderCalendarHTML } from "./calendar.ts";
import { appEl, editToolbarEl, gridEl, nextBtn, pageCountEl, pageTitleEl, prevBtn } from "./dom.ts";
import { colorWithOpacity, currentPage, escHtml, getActiveLinks, getVariantIndex } from "./helpers.ts";
import { computeLayout, type Placement } from "./layout.ts";
import { state } from "./state.ts";

export function renderPage(): void {
  if (!state) return;
  const page = currentPage();
  if (!page) return;

  const { board } = state.boardState;

  pageTitleEl.textContent = page.title;
  const total = board.pageIds.length;
  pageCountEl.textContent =
    total > 1 ? `${state.currentPageIndex + 1} / ${total}` : "";
  prevBtn.disabled = state.currentPageIndex === 0;
  nextBtn.disabled = state.currentPageIndex === total - 1;

  appEl.style.backgroundColor = page.backgroundColor;
  appEl.style.backgroundImage = page.backgroundImage
    ? `url(${page.backgroundImage})`
    : "none";

  appEl.classList.toggle("edit-mode", state.isEditMode);
  editToolbarEl.classList.toggle("hidden", !state.isEditMode);

  gridEl.classList.toggle("calendar-view", isCalendarPage(page));
  if (isCalendarPage(page)) {
    gridEl.innerHTML = renderCalendarHTML(page);
    return;
  }

  const { cells } = state.boardState;
  const layout = computeLayout(page, cells);
  // In edit mode, track 1 of each axis holds the row/column action buttons.
  const offset = state.isEditMode ? 2 : 1;

  const colActionsHTML = state.isEditMode
    ? Array.from({ length: page.columns }, (_, colIdx) =>
        `<div class="col-actions" data-col="${colIdx}" style="grid-row:1;grid-column:${colIdx + offset}">
           <button class="col-action-btn" data-action="col-add-before" title="Add column before">+</button>
           <button class="col-action-btn col-action-remove" data-action="col-remove" title="Remove column">&minus;</button>
           <button class="col-action-btn" data-action="col-add-after" title="Add column after">+</button>
         </div>`).join("")
    : "";

  const rowActionsHTML = state.isEditMode
    ? Array.from({ length: layout.rows }, (_, rowIdx) =>
        `<div class="row-actions" data-row="${rowIdx}" style="grid-row:${rowIdx + offset};grid-column:1">
           <button class="row-action-btn" data-action="row-add-before" title="Add row before">+</button>
           <button class="row-action-btn row-action-remove" data-action="row-remove" title="Remove row">&minus;</button>
           <button class="row-action-btn" data-action="row-add-after" title="Add row after">+</button>
         </div>`).join("")
    : "";

  const cellsHTML = layout.placements
    .map((p) => renderCellHTML(cells[p.cellId], p, layout.rows, page.columns, offset))
    .join("");

  gridEl.innerHTML = `<div class="grid-layout" style="--grid-cols:${page.columns};--grid-rows:${layout.rows}">${colActionsHTML}${rowActionsHTML}${cellsHTML}</div>`;

  if (!state.isEditMode) {
    const activeCellIds = layout.placements
      .map((p) => cells[p.cellId])
      .filter((c) => c && getActiveLinks(c).length > 0)
      .map((c) => c!.id);
    if (activeCellIds.length > 0) {
      apiPost<unknown>(ApiEndpoint.Impression, {
        cellIds: activeCellIds,
      } satisfies ImpressionRequest).catch(() => undefined);
    }
  }
}

function resizeControlsHTML(p: Placement, rows: number, cols: number): string {
  const buttons = [
    p.colSpan > 1 ? `<button class="cell-resize-btn" data-action="shrink-right" title="Narrower">&larr;</button>` : "",
    p.col + p.colSpan < cols ? `<button class="cell-resize-btn" data-action="grow-right" title="Wider">&rarr;</button>` : "",
    p.rowSpan > 1 ? `<button class="cell-resize-btn" data-action="shrink-down" title="Shorter">&uarr;</button>` : "",
    p.row + p.rowSpan < rows ? `<button class="cell-resize-btn" data-action="grow-down" title="Taller">&darr;</button>` : "",
  ].join("");
  return buttons ? `<div class="cell-resize-controls">${buttons}</div>` : "";
}

export function renderCellHTML(
  cell: Cell | undefined,
  p: Placement,
  rows: number,
  cols: number,
  offset: number,
): string {
  const gridArea = `grid-row:${p.row + offset} / span ${p.rowSpan};grid-column:${p.col + offset} / span ${p.colSpan}`;
  const area = `style="${gridArea}"`;
  if (!cell) return `<div class="cell empty" ${area}></div>`;

  const activeLinks = getActiveLinks(cell);
  const resizeControls = state?.isEditMode ? resizeControlsHTML(p, rows, cols) : "";

  if (activeLinks.length === 0) {
    if (state?.isEditMode) {
      return `<div class="cell empty" ${area} data-cell-id="${cell.id}" data-action="edit-cell">${resizeControls}</div>`;
    }
    return `<div class="cell empty" ${area}></div>`;
  }

  let linkIdx: number;
  if (state?.isEditMode) {
    linkIdx = cell.currentEditingIndex;
  } else {
    linkIdx = getVariantIndex(cell);
  }

  const safeIdx = Math.min(linkIdx, cell.links.length - 1);
  const link = cell.links[safeIdx] ?? activeLinks[0]!;
  const variantCount = activeLinks.length;
  const variantLabel =
    state?.isEditMode && variantCount > 1
      ? `<span class="variant-badge">${safeIdx + 1}/${variantCount}</span>`
      : "";

  const img = link.image
    ? `<img class="cell-bg" src="${escHtml(link.image)}" alt="" loading="lazy">`
    : "";
  let bg: string;
  if (link.noBlur) {
    bg = `<div class="cell-color-bg" style="background:${escHtml(link.backgroundColor)}"></div>${img}`;
  } else if (link.image) {
    bg = `<img class="cell-bg-blur" src="${escHtml(link.imageStill || link.image)}" alt="" aria-hidden="true" loading="lazy">
       ${img}`;
  } else {
    bg = `<div class="cell-color-bg"></div>`;
  }

  // The inline border also replaces the edit-mode outline, so editors preview the real look.
  const activeArea = link.borderColor
    ? `style="${gridArea};border:2px solid ${escHtml(link.borderColor)}"`
    : area;

  const titleBar = link.title
    ? `<div class="cell-title-bar" style="background-color: ${colorWithOpacity(link.backgroundColor, link.backgroundOpacity)}">
         <span class="cell-title-text" style="color:${escHtml(link.textColor)}">${escHtml(link.title)}</span>
       </div>`
    : "";

  const infoBtn =
    link.description
      ? `<button class="info-btn" data-action="info" data-description="${escHtml(link.description)}" title="Info">i</button>`
      : "";

  const editControls = state?.isEditMode
    ? `<div class="cell-edit-controls">
         <button class="cell-edit-btn rotate" data-action="rotate" title="Next variant">&#8635;</button>
         <button class="cell-edit-btn add-variant" data-action="add-variant" title="Add variant">+</button>
         <button class="cell-edit-btn del-variant" data-action="del-variant" title="Delete variant">&times;</button>
       </div>`
    : "";

  const uri = link.uri;
  // Viewers only get the link cursor when clicking actually opens something.
  const noLink = !uri && !state?.isEditMode ? " no-link" : "";
  return `<div class="cell active${noLink}" ${activeArea} data-cell-id="${cell.id}" data-link-id="${link.id}" data-uri="${escHtml(uri)}">
    ${bg}
    ${titleBar}
    ${infoBtn}
    ${variantLabel}
    ${editControls}
    ${resizeControls}
  </div>`;
}
