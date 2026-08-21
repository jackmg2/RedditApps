export const appEl = document.getElementById("app") as HTMLDivElement;
export const pageTitleEl = document.getElementById("page-title") as HTMLHeadingElement;
export const pageCountEl = document.getElementById("page-count") as HTMLSpanElement;
export const prevBtn = document.getElementById("prev-page") as HTMLButtonElement;
export const nextBtn = document.getElementById("next-page") as HTMLButtonElement;
export const editToggleBtn = document.getElementById("edit-toggle") as HTMLButtonElement;
export const editToolbarEl = document.getElementById("edit-toolbar") as HTMLDivElement;
export const gridEl = document.getElementById("grid") as HTMLElement;
export const emptyStateEl = document.getElementById("empty-state") as HTMLDivElement;
export const modalOverlay   = document.getElementById("modal-overlay")   as HTMLDivElement;
export const modalCard      = document.getElementById("modal-card")      as HTMLDivElement;
export const modalTitle     = document.getElementById("modal-title")     as HTMLHeadingElement;
export const modalCloseBtn  = document.getElementById("modal-close-btn") as HTMLButtonElement;
export const modalBody      = document.getElementById("modal-body")      as HTMLDivElement;
export const migrateBtnEl = document.getElementById("btn-migrate") as HTMLButtonElement;

export function showEmpty(msg: string): void {
  gridEl.classList.add("hidden");
  emptyStateEl.classList.remove("hidden");
  (document.getElementById("empty-msg") as HTMLParagraphElement).textContent = msg;
}
