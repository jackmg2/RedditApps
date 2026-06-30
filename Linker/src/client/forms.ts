import { ApiEndpoint, type Page, type UploadImageResponse } from "../shared/api.ts";
import { apiPost } from "./api.ts";
import { modalBody } from "./dom.ts";
import { escHtml, getActiveLinks, newLink } from "./helpers.ts";
import { closeModal, openModal } from "./modals.ts";
import { renderPage } from "./render.ts";
import { state } from "./state.ts";

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxWidth = 800;
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = reject;
    img.src = objectUrl;
  });
}

function pickAndUploadImage(urlInputId: string, statusId: string): void {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";
  document.body.appendChild(fileInput);

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    document.body.removeChild(fileInput);
    if (!file) return;

    const statusEl = document.getElementById(statusId);
    if (statusEl) statusEl.textContent = "Uploading…";

    try {
      const dataUrl = await compressImage(file);
      const { mediaUrl } = await apiPost<UploadImageResponse>(
        ApiEndpoint.UploadImage,
        { dataUrl },
      );
      const urlInput = document.getElementById(urlInputId) as HTMLInputElement | null;
      if (urlInput) urlInput.value = mediaUrl;
      if (statusEl) statusEl.textContent = "Done";
    } catch {
      if (statusEl) statusEl.textContent = "Upload failed";
    }
  });

  fileInput.click();
}

export function openCellForm(cellId: string, linkIndex: number): void {
  if (!state) return;
  const cell = state.boardState.cells[cellId];
  if (!cell) return;

  const safeIdx = Math.min(linkIndex, cell.links.length - 1);
  const link = cell.links[safeIdx] ?? newLink();

  const totalClicks = cell.links.reduce((sum, l) => sum + (l.clickCount ?? 0), 0);
  const pctHtml = cell.links.length > 1
    ? `<div class="analytics-row">
        <span class="analytics-label">% des clics (cellule)</span>
        <span class="analytics-value">${totalClicks > 0 ? Math.round(((link.clickCount ?? 0) / totalClicks) * 100) : 0}%</span>
      </div>`
    : '';

  openModal(`Edit Link (variant ${safeIdx + 1}/${cell.links.length})`);
  modalBody.innerHTML = `
    <div class="form-group">
      <label>Title</label>
      <input type="text" id="fl-title" value="${escHtml(link.title)}">
    </div>
    <div class="form-group">
      <label>URL</label>
      <input type="text" id="fl-url" value="${escHtml(link.uri)}" placeholder="https://...">
    </div>
    <div class="form-group">
      <label>Image URL</label>
      <div class="input-with-action">
        <input type="text" id="fl-image" value="${escHtml(link.image)}" placeholder="https://...">
        <button type="button" id="fl-image-pick" class="btn-secondary">Choose file</button>
      </div>
      <span id="fl-image-status" class="input-status"></span>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Text Color</label>
        <input type="color" id="fl-text-color" value="${link.textColor}">
      </div>
      <div class="form-group">
        <label>BG Color</label>
        <input type="color" id="fl-bg-color" value="${link.backgroundColor}">
      </div>
    </div>
    <div class="form-group">
      <label>BG Opacity (0–1)</label>
      <input type="number" id="fl-opacity" min="0" max="1" step="0.05" value="${link.backgroundOpacity}">
    </div>
    <div class="form-group">
      <label>Description</label>
      <textarea id="fl-description">${escHtml(link.description)}</textarea>
    </div>
    <div class="form-group">
      <label>Variant Weight</label>
      <input type="number" id="fl-weight" min="1" step="1" value="${cell.weights[safeIdx] ?? 1}">
    </div>
    <div class="form-stats">
      <div class="analytics-row">
        <span class="analytics-label">Clics</span>
        <span class="analytics-value">${link.clickCount ?? 0}</span>
      </div>
      ${pctHtml}
    </div>
    <div class="form-buttons">
      <button class="btn-cancel" id="fl-cancel">Cancel</button>
      <button class="btn-primary" id="fl-save">Save</button>
    </div>`;

  document.getElementById("fl-cancel")!.addEventListener("click", closeModal);
  document.getElementById("fl-save")!.addEventListener("click", () => {
    saveCellForm(cellId, safeIdx);
  });
  document.getElementById("fl-image-pick")!.addEventListener("click", () => {
    pickAndUploadImage("fl-image", "fl-image-status");
  });
}

export function saveCellForm(cellId: string, linkIndex: number): void {
  if (!state) return;
  const cell = state.boardState.cells[cellId];
  if (!cell) return;

  const title = (document.getElementById("fl-title") as HTMLInputElement).value.trim();
  const uri = (document.getElementById("fl-url") as HTMLInputElement).value.trim();
  const image = (document.getElementById("fl-image") as HTMLInputElement).value.trim();
  const textColor = (document.getElementById("fl-text-color") as HTMLInputElement).value;
  const backgroundColor = (document.getElementById("fl-bg-color") as HTMLInputElement).value;
  const backgroundOpacity = parseFloat(
    (document.getElementById("fl-opacity") as HTMLInputElement).value,
  );
  const description = (document.getElementById("fl-description") as HTMLTextAreaElement).value.trim();
  const weight = Math.max(
    1,
    parseInt((document.getElementById("fl-weight") as HTMLInputElement).value, 10) || 1,
  );

  const safeIdx = Math.min(linkIndex, cell.links.length - 1);
  const existing = cell.links[safeIdx];
  if (!existing) return;

  existing.title = title;
  existing.uri = uri;
  existing.image = image;
  existing.textColor = textColor;
  existing.backgroundColor = backgroundColor;
  existing.backgroundOpacity = Number.isFinite(backgroundOpacity)
    ? Math.max(0, Math.min(1, backgroundOpacity))
    : 0.5;
  existing.description = description;

  while (cell.weights.length <= safeIdx) cell.weights.push(1);
  cell.weights[safeIdx] = weight;

  const activeLinks = getActiveLinks(cell);
  cell.rotationEnabled = activeLinks.length >= 2;

  state.isDirty = true;
  closeModal();
  renderPage();
}

export function openPageForm(page: Page): void {
  openModal("Edit Page");
  modalBody.innerHTML = `
    <div class="form-group">
      <label>Title</label>
      <input type="text" id="fp-title" value="${escHtml(page.title)}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Background Color</label>
        <input type="color" id="fp-bg" value="${page.backgroundColor}">
      </div>
      <div class="form-group">
        <label>Foreground Color</label>
        <input type="color" id="fp-fg" value="${page.foregroundColor}">
      </div>
    </div>
    <div class="form-group">
      <label>Background Image (leave empty to clear)</label>
      <div class="input-with-action">
        <input type="text" id="fp-bg-image" value="${escHtml(page.backgroundImage)}" placeholder="https://...">
        <button type="button" id="fp-bg-image-pick" class="btn-secondary">Choose file</button>
      </div>
      <span id="fp-bg-image-status" class="input-status"></span>
    </div>
    <div class="form-buttons">
      <button class="btn-cancel" id="fp-cancel">Cancel</button>
      <button class="btn-primary" id="fp-save">Save</button>
    </div>`;

  document.getElementById("fp-cancel")!.addEventListener("click", closeModal);
  document.getElementById("fp-bg-image-pick")!.addEventListener("click", () => {
    pickAndUploadImage("fp-bg-image", "fp-bg-image-status");
  });
  document.getElementById("fp-save")!.addEventListener("click", () => {
    page.title = (document.getElementById("fp-title") as HTMLInputElement).value.trim() || page.title;
    page.backgroundColor = (document.getElementById("fp-bg") as HTMLInputElement).value;
    page.foregroundColor = (document.getElementById("fp-fg") as HTMLInputElement).value;
    page.backgroundImage = (document.getElementById("fp-bg-image") as HTMLInputElement).value.trim();
    if (state) state.isDirty = true;
    closeModal();
    renderPage();
  });
}
