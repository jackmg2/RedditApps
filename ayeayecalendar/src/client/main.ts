import { ApiEndpoint, type InitResponse } from "../shared/api.ts";
import { state } from "./state.ts";
import { editToggleBtn, loadingEl } from "./dom.ts";
import { render } from "./render.ts";
import { initToolbar } from "./toolbar.ts";

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

editToggleBtn.addEventListener("click", () => {
  state.editMode = !state.editMode;
  render();
});

initToolbar();

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

async function init(): Promise<void> {
  try {
    const response = await fetch(ApiEndpoint.Init);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as InitResponse;

    state.postId = data.postId;
    state.username = data.username;
    state.isModerator = data.isModerator;
    state.events = data.events;
    state.config = data.config;

    render();
  } catch (err) {
    loadingEl.textContent = `Failed to load calendar: ${err instanceof Error ? err.message : String(err)}`;
  }
}

init();
