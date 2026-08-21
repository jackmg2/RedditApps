import type { PageType } from "../shared/api.ts";
import { modalBody, modalCloseBtn, modalOverlay, modalTitle } from "./dom.ts";
import { escHtml } from "./helpers.ts";

export function openModal(title: string): void {
  modalTitle.textContent = title;
  modalBody.innerHTML = "";
  modalOverlay.classList.remove("hidden");
}

export function closeModal(): void {
  modalOverlay.classList.add("hidden");
  modalBody.innerHTML = "";
}

export function setupModalOverlay(): void {
  modalOverlay.addEventListener("click", (e: Event) => {
    if (e.target === modalOverlay) closeModal();
  });
  modalCloseBtn.addEventListener("click", closeModal);
}

export function showConfirmDialog(message: string, onConfirm: () => void): void {
  openModal("Confirm");
  modalBody.innerHTML = `
    <p class="confirm-msg">${escHtml(message)}</p>
    <div class="form-buttons">
      <button class="btn-cancel" id="confirm-cancel">Cancel</button>
      <button class="btn-primary danger" id="confirm-ok">Confirm</button>
    </div>`;

  document.getElementById("confirm-cancel")!.addEventListener("click", closeModal);
  document.getElementById("confirm-ok")!.addEventListener("click", () => {
    closeModal();
    onConfirm();
  });
}

export function showAddPageDialog(
  onCreate: (title: string, type: PageType) => void,
): void {
  openModal("Add Page");
  modalBody.innerHTML = `
    <div class="form-group">
      <label>Title</label>
      <input type="text" id="ap-title" value="New Page">
    </div>
    <div class="form-group">
      <label>Page Type</label>
      <select id="ap-type">
        <option value="grid" selected>Link grid</option>
        <option value="calendar">Event calendar</option>
      </select>
    </div>
    <div class="form-buttons">
      <button class="btn-cancel" id="ap-cancel">Cancel</button>
      <button class="btn-primary" id="ap-create">Create</button>
    </div>`;

  document.getElementById("ap-cancel")!.addEventListener("click", closeModal);
  document.getElementById("ap-create")!.addEventListener("click", () => {
    const title =
      (document.getElementById("ap-title") as HTMLInputElement).value.trim() ||
      "New Page";
    const type = (document.getElementById("ap-type") as HTMLSelectElement)
      .value as PageType;
    closeModal();
    onCreate(title, type);
  });
}

export function showInfoPopup(description: string): void {
  openModal("Info");
  modalBody.innerHTML = `
    <p class="info-popup-text">${escHtml(description)}</p>
    <div class="form-buttons">
      <button class="btn-primary" id="info-close">Close</button>
    </div>`;
  document.getElementById("info-close")!.addEventListener("click", closeModal);
}
