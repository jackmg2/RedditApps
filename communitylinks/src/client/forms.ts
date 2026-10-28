import { ApiEndpoint, type CalendarEvent, type Page, type UploadImageResponse } from "../shared/api.ts";
import { apiPost } from "./api.ts";
import { newCalendarEvent, validateEvent } from "./calendar.ts";
import { modalBody } from "./dom.ts";
import { resizeCell } from "./grid.ts";
import { currentPage, escHtml, getActiveLinks, newLink } from "./helpers.ts";
import { computeLayout } from "./layout.ts";
import { closeModal, openModal } from "./modals.ts";
import { renderPage } from "./render.ts";
import { state } from "./state.ts";

// GIFs are uploaded as-is (a canvas would flatten them to one frame), so cap their size
const MAX_GIF_BYTES = 3 * 1024 * 1024;
// The still frame only feeds the blurred backdrop, so it can be tiny
const STILL_MAX_WIDTH = 200;

async function compressImage(file: File, maxWidth = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
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

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadImage(dataUrl: string, type: "image" | "gif"): Promise<string> {
  const { mediaUrl } = await apiPost<UploadImageResponse>(
    ApiEndpoint.UploadImage,
    { dataUrl, type },
  );
  if (!mediaUrl) throw new Error("upload failed");
  return mediaUrl;
}

// stillInputId, when given, receives a still-frame URL for animated uploads ("" otherwise)
function pickAndUploadImage(urlInputId: string, statusId: string, stillInputId?: string): void {
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
    const isGif = file.type === "image/gif";
    if (isGif && file.size > MAX_GIF_BYTES) {
      if (statusEl) statusEl.textContent = "GIF too large (max 3 MB)";
      return;
    }
    if (statusEl) statusEl.textContent = "Uploading…";

    try {
      let mediaUrl: string;
      let stillUrl = "";
      if (isGif) {
        [mediaUrl, stillUrl] = await Promise.all([
          readAsDataUrl(file).then((dataUrl) => uploadImage(dataUrl, "gif")),
          stillInputId
            ? compressImage(file, STILL_MAX_WIDTH).then((dataUrl) => uploadImage(dataUrl, "image"))
            : "",
        ]);
      } else {
        mediaUrl = await uploadImage(await compressImage(file), "image");
      }
      const urlInput = document.getElementById(urlInputId) as HTMLInputElement | null;
      if (urlInput) urlInput.value = mediaUrl;
      if (stillInputId) {
        const stillInput = document.getElementById(stillInputId) as HTMLInputElement | null;
        if (stillInput) stillInput.value = stillUrl;
      }
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

  const page = currentPage();
  const layout = page ? computeLayout(page, state.boardState.cells) : null;
  const placement = layout?.placements.find((p) => p.cellId === cellId);
  const sizeHtml = page && layout && placement
    ? `<div class="form-row">
        <div class="form-group">
          <label>Width (columns)</label>
          <input type="number" id="fl-col-span" min="1" max="${page.columns - placement.col}" step="1" value="${placement.colSpan}">
        </div>
        <div class="form-group">
          <label>Height (rows)</label>
          <input type="number" id="fl-row-span" min="1" max="${layout.rows - placement.row}" step="1" value="${placement.rowSpan}">
        </div>
      </div>`
    : "";

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
      <input type="hidden" id="fl-image-still" value="${escHtml(link.imageStill ?? "")}">
      <span id="fl-image-status" class="input-status"></span>
    </div>
    <div class="form-group">
      <label class="form-check"><input type="checkbox" id="fl-blur"${link.noBlur ? "" : " checked"}> Blurred picture behind image</label>
      <span class="input-status">When unchecked, BG Color fills the cell.</span>
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
      <label class="form-check"><input type="checkbox" id="fl-border"${link.borderColor ? " checked" : ""}> Border</label>
      <input type="color" id="fl-border-color" value="${escHtml(link.borderColor ?? "#FFFFFF")}"${link.borderColor ? "" : " disabled"}>
    </div>
    <div class="form-group">
      <label>Description</label>
      <textarea id="fl-description">${escHtml(link.description)}</textarea>
    </div>
    <div class="form-group">
      <label>Variant Weight</label>
      <input type="number" id="fl-weight" min="1" step="1" value="${cell.weights[safeIdx] ?? 1}">
    </div>
    ${sizeHtml}
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
    pickAndUploadImage("fl-image", "fl-image-status", "fl-image-still");
  });
  // A hand-edited URL no longer matches the uploaded still frame
  document.getElementById("fl-image")!.addEventListener("input", () => {
    (document.getElementById("fl-image-still") as HTMLInputElement).value = "";
  });
  const borderCheck = document.getElementById("fl-border") as HTMLInputElement;
  borderCheck.addEventListener("change", () => {
    (document.getElementById("fl-border-color") as HTMLInputElement).disabled = !borderCheck.checked;
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
  const imageStill = (document.getElementById("fl-image-still") as HTMLInputElement).value;
  if (image && imageStill) existing.imageStill = imageStill;
  else delete existing.imageStill;
  existing.textColor = textColor;
  existing.backgroundColor = backgroundColor;
  existing.backgroundOpacity = Number.isFinite(backgroundOpacity)
    ? Math.max(0, Math.min(1, backgroundOpacity))
    : 0.5;
  if ((document.getElementById("fl-blur") as HTMLInputElement).checked) delete existing.noBlur;
  else existing.noBlur = true;
  if ((document.getElementById("fl-border") as HTMLInputElement).checked) {
    existing.borderColor = (document.getElementById("fl-border-color") as HTMLInputElement).value;
  } else {
    delete existing.borderColor;
  }
  existing.description = description;

  while (cell.weights.length <= safeIdx) cell.weights.push(1);
  cell.weights[safeIdx] = weight;

  const activeLinks = getActiveLinks(cell);
  cell.rotationEnabled = activeLinks.length >= 2;

  const rowSpanInput = document.getElementById("fl-row-span") as HTMLInputElement | null;
  const colSpanInput = document.getElementById("fl-col-span") as HTMLInputElement | null;
  const rowSpan = rowSpanInput ? parseInt(rowSpanInput.value, 10) || 1 : null;
  const colSpan = colSpanInput ? parseInt(colSpanInput.value, 10) || 1 : null;

  state.isDirty = true;
  closeModal();
  renderPage();
  // May open its own confirm dialog when the cell grows over other links.
  if (rowSpan !== null && colSpan !== null) resizeCell(cellId, rowSpan, colSpan);
}

function timeZoneSelectHTML(value: string): string {
  // Fallback for environments without Intl.supportedValuesOf
  if (typeof Intl.supportedValuesOf !== "function") {
    return `<input type="text" id="fe-timezone" value="${escHtml(value)}" placeholder="e.g. America/New_York">`;
  }

  const zones = Intl.supportedValuesOf("timeZone");
  let found = !value;
  let html = `<select id="fe-timezone"><option value=""${value ? "" : " selected"}>None (show times as written)</option>`;

  let openRegion = "";
  for (const tz of zones) {
    const slash = tz.indexOf("/");
    const region = slash === -1 ? "Other" : tz.slice(0, slash);
    if (region !== openRegion) {
      if (openRegion) html += "</optgroup>";
      html += `<optgroup label="${escHtml(region)}">`;
      openRegion = region;
    }
    const label = slash === -1 ? tz : tz.slice(slash + 1).replace(/_/g, " ");
    const selected = tz === value ? " selected" : "";
    if (selected) found = true;
    html += `<option value="${escHtml(tz)}"${selected}>${escHtml(label)}</option>`;
  }
  if (openRegion) html += "</optgroup>";

  if (!found) {
    // Stored zone missing from the list (e.g. renamed) — keep it selectable
    html += `<option value="${escHtml(value)}" selected>${escHtml(value)}</option>`;
  }
  return html + "</select>";
}

export function openEventForm(page: Page, eventId?: string): void {
  const existing = eventId ? page.events?.[eventId] : undefined;
  const event: CalendarEvent = existing ?? newCalendarEvent();

  openModal(existing ? "Edit Event" : "Add Event");
  modalBody.innerHTML = `
    <div class="form-group">
      <label>Title</label>
      <input type="text" id="fe-title" value="${escHtml(event.title)}">
    </div>
    <div class="form-group">
      <label>Description</label>
      <textarea id="fe-description">${escHtml(event.description)}</textarea>
    </div>
    <div class="form-group">
      <label>Link (optional)</label>
      <input type="text" id="fe-link" value="${escHtml(event.link)}" placeholder="https://...">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Start Date</label>
        <input type="date" id="fe-date-begin" value="${escHtml(event.dateBegin)}">
      </div>
      <div class="form-group">
        <label>End Date</label>
        <input type="date" id="fe-date-end" value="${escHtml(event.dateEnd)}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Start Time (optional)</label>
        <input type="text" id="fe-hour-begin" value="${escHtml(event.hourBegin)}" placeholder="e.g. 2:00 PM">
      </div>
      <div class="form-group">
        <label>End Time (optional)</label>
        <input type="text" id="fe-hour-end" value="${escHtml(event.hourEnd)}" placeholder="e.g. 4:00 PM">
      </div>
    </div>
    <div class="form-group">
      <label>Time Zone</label>
      ${timeZoneSelectHTML(event.timezone ?? "")}
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>BG Color</label>
        <input type="color" id="fe-bg-color" value="${event.backgroundColor}">
      </div>
      <div class="form-group">
        <label>Text Color</label>
        <input type="color" id="fe-fg-color" value="${event.foregroundColor}">
      </div>
    </div>
    <div class="form-error hidden" id="fe-error"></div>
    <div class="form-buttons">
      <button class="btn-cancel" id="fe-cancel">Cancel</button>
      <button class="btn-primary" id="fe-save">Save</button>
    </div>`;

  document.getElementById("fe-cancel")!.addEventListener("click", closeModal);
  document.getElementById("fe-save")!.addEventListener("click", () => {
    const draft: CalendarEvent = {
      id: event.id,
      title: (document.getElementById("fe-title") as HTMLInputElement).value.trim(),
      description: (document.getElementById("fe-description") as HTMLTextAreaElement).value.trim(),
      link: (document.getElementById("fe-link") as HTMLInputElement).value.trim(),
      dateBegin: (document.getElementById("fe-date-begin") as HTMLInputElement).value,
      dateEnd: (document.getElementById("fe-date-end") as HTMLInputElement).value,
      hourBegin: (document.getElementById("fe-hour-begin") as HTMLInputElement).value.trim(),
      hourEnd: (document.getElementById("fe-hour-end") as HTMLInputElement).value.trim(),
      timezone: (document.getElementById("fe-timezone") as HTMLSelectElement | HTMLInputElement).value.trim(),
      backgroundColor: (document.getElementById("fe-bg-color") as HTMLInputElement).value,
      foregroundColor: (document.getElementById("fe-fg-color") as HTMLInputElement).value,
    };

    const error = validateEvent(draft);
    const errorEl = document.getElementById("fe-error")!;
    if (error) {
      errorEl.textContent = error;
      errorEl.classList.remove("hidden");
      return;
    }

    page.events = page.events ?? {};
    page.events[draft.id] = draft;
    if (state) state.isDirty = true;
    closeModal();
    renderPage();
  });
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
