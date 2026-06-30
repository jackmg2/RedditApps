import { ApiEndpoint, type Cell, type ImpressionRequest } from "../shared/api.ts";
import { apiPost } from "./api.ts";
import { appEl, editToolbarEl, gridEl, nextBtn, pageCountEl, pageTitleEl, prevBtn } from "./dom.ts";
import { colorWithOpacity, currentPage, escHtml, getActiveLinks, getVariantIndex } from "./helpers.ts";
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

  gridEl.style.setProperty("--grid-cols", String(page.columns));
  const numRows = Math.ceil(page.cellIds.length / page.columns);

  appEl.classList.toggle("edit-mode", state.isEditMode);
  editToolbarEl.classList.toggle("hidden", !state.isEditMode);

  const colActionsHTML = state.isEditMode
    ? `<div class="col-actions-row">
         <div class="col-actions-spacer"></div>
         <div class="col-headers">${Array.from({ length: page.columns }, (_, colIdx) =>
           `<div class="col-actions" data-col="${colIdx}">
              <button class="col-action-btn" data-action="col-add-before" title="Add column before">+</button>
              <button class="col-action-btn col-action-remove" data-action="col-remove" title="Remove column">&minus;</button>
              <button class="col-action-btn" data-action="col-add-after" title="Add column after">+</button>
            </div>`).join("")}
         </div>
       </div>`
    : "";

  const cells = page.cellIds.map((id) => state!.boardState.cells[id]);
  gridEl.innerHTML = colActionsHTML + Array.from({ length: numRows }, (_, rowIdx) => {
    const rowCells = cells.slice(rowIdx * page.columns, (rowIdx + 1) * page.columns);
    const actionsHTML = state!.isEditMode
      ? `<div class="row-actions" data-row="${rowIdx}">
           <button class="row-action-btn" data-action="row-add-before" title="Add row before">+</button>
           <button class="row-action-btn row-action-remove" data-action="row-remove" title="Remove row">&minus;</button>
           <button class="row-action-btn" data-action="row-add-after" title="Add row after">+</button>
         </div>`
      : "";
    return `<div class="row-wrapper">${actionsHTML}<div class="row-cells">${rowCells.map((cell) => renderCellHTML(cell)).join("")}</div></div>`;
  }).join("");

  if (!state.isEditMode) {
    const activeCellIds = cells
      .filter((c) => c && getActiveLinks(c).length > 0)
      .map((c) => c!.id);
    if (activeCellIds.length > 0) {
      apiPost<unknown>(ApiEndpoint.Impression, {
        cellIds: activeCellIds,
      } satisfies ImpressionRequest).catch(() => undefined);
    }
  }
}

export function renderCellHTML(cell: Cell | undefined): string {
  if (!cell) return `<div class="cell empty"></div>`;

  const activeLinks = getActiveLinks(cell);

  if (activeLinks.length === 0) {
    if (state?.isEditMode) {
      return `<div class="cell empty" data-cell-id="${cell.id}" data-action="edit-cell"></div>`;
    }
    return `<div class="cell empty"></div>`;
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

  const bg = link.image
    ? `<img class="cell-bg-blur" src="${escHtml(link.image)}" alt="" aria-hidden="true" loading="lazy">
       <img class="cell-bg" src="${escHtml(link.image)}" alt="" loading="lazy">`
    : `<div class="cell-color-bg"></div>`;

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
  return `<div class="cell active" data-cell-id="${cell.id}" data-link-id="${link.id}" data-uri="${escHtml(uri)}">
    ${bg}
    ${titleBar}
    ${infoBtn}
    ${variantLabel}
    ${editControls}
  </div>`;
}
