import { openAnalyticsModal } from "./analytics.ts";
import { openPageForm } from "./forms.ts";
import { addPage, removePage } from "./grid.ts";
import { currentPage } from "./helpers.ts";

export function setupToolbar(): void {
  document.getElementById("btn-edit-page")!.addEventListener("click", () => {
    const page = currentPage();
    if (page) openPageForm(page);
  });

document.getElementById("btn-add-page-before")!.addEventListener("click", () => {
    addPage("before");
  });

  document.getElementById("btn-add-page-after")!.addEventListener("click", () => {
    addPage("after");
  });

  document.getElementById("btn-remove-page")!.addEventListener("click", () => {
    removePage();
  });

  document.getElementById("btn-analytics")!.addEventListener("click", () => {
    openAnalyticsModal();
  });


}
