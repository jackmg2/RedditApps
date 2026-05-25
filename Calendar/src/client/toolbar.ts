import { addEventBtn, setBgBtn, modToolbar } from "./dom.ts";
import { openAddEventModal, openSettingsModal } from "./forms.ts";

export function initToolbar(): void {
  addEventBtn.addEventListener("click", openAddEventModal);
  setBgBtn.addEventListener("click", openSettingsModal);
}

export function setToolbarVisible(visible: boolean): void {
  modToolbar.classList.toggle("hidden", !visible);
}
