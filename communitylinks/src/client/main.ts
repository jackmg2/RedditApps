import { ApiEndpoint, type InitResponse, type MigrateResponse } from "../shared/api.ts";
import { apiGet, apiPost } from "./api.ts";
import { editToggleBtn, emptyStateEl, gridEl, migrateBtnEl, showEmpty } from "./dom.ts";
import { setupEditToggle, setupGridEvents, setupNavigation } from "./events.ts";
import { setupModalOverlay } from "./modals.ts";
import { renderPage } from "./render.ts";
import { setState } from "./state.ts";
import { setupToolbar } from "./toolbar.ts";

async function init(): Promise<void> {
  try {
    const data = await apiGet<InitResponse>(ApiEndpoint.Init);

    if (data.needsMigration && data.isEditor) {
      showEmpty("This post uses the legacy data format.");
      migrateBtnEl.classList.remove("hidden");
      migrateBtnEl.addEventListener("click", async () => {
        migrateBtnEl.disabled = true;
        migrateBtnEl.textContent = "Migrating…";
        try {
          const result = await apiPost<MigrateResponse>(ApiEndpoint.Migrate, {});
          migrateBtnEl.classList.add("hidden");
          emptyStateEl.classList.add("hidden");
          gridEl.classList.remove("hidden");
          setState({
            boardState: result.boardState,
            currentPageIndex: 0,
            isEditMode: false,
            username: data.username,
            isEditor: data.isEditor,
            isModerator: data.isModerator,
            isDirty: false,
            variantSelections: new Map(),
          });
          editToggleBtn.classList.remove("hidden");
          setupToolbar();
          renderPage();
        } catch (e) {
          migrateBtnEl.disabled = false;
          migrateBtnEl.textContent = "Migrate Legacy Data";
          console.error("Migration failed", e);
        }
      }, { once: true });
      return;
    }

    if (data.type !== "init" || !data.boardState) {
      showEmpty("No board found for this post.");
      return;
    }

    setState({
      boardState: data.boardState,
      currentPageIndex: 0,
      isEditMode: false,
      username: data.username,
      isEditor: data.isEditor,
      isModerator: data.isModerator,
      isDirty: false,
      variantSelections: new Map(),
    });

    if (data.isEditor) {
      editToggleBtn.classList.remove("hidden");
    }

    setupToolbar();
    renderPage();
  } catch (e) {
    console.error("Init failed", e);
    showEmpty("Failed to load board.");
  }
}

setupGridEvents();
setupNavigation();
setupEditToggle();
setupModalOverlay();

init();
