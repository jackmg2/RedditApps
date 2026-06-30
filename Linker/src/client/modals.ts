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

export function showInfoPopup(description: string): void {
  openModal("Info");
  modalBody.innerHTML = `
    <p class="info-popup-text">${escHtml(description)}</p>
    <div class="form-buttons">
      <button class="btn-primary" id="info-close">Close</button>
    </div>`;
  document.getElementById("info-close")!.addEventListener("click", closeModal);
}
