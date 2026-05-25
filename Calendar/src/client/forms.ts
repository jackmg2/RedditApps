import {
  ApiEndpoint,
  type CalendarEvent,
  type CalendarConfig,
  type SaveEventRequest,
  type SaveEventResponse,
  type DeleteEventRequest,
  type DeleteEventResponse,
  type SaveConfigRequest,
  type SaveConfigResponse,
  type UploadImageRequest,
  type UploadImageResponse,
} from "../shared/api.ts";
import { state } from "./state.ts";
import {
  modalTitle,
  modalBody,
  modalOverlay,
  modalCloseBtn,
  eventsContainer,
} from "./dom.ts";
import { todayString, generateId, validateEvent } from "./utils.ts";
import { showToast } from "./toast.ts";
import { render } from "./render.ts";

// ---------------------------------------------------------------------------
// Image upload helpers
// ---------------------------------------------------------------------------

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
      const response = await fetch(ApiEndpoint.UploadImage, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl } satisfies UploadImageRequest),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { mediaUrl } = (await response.json()) as UploadImageResponse;
      const urlInput = document.getElementById(urlInputId) as HTMLInputElement | null;
      if (urlInput) urlInput.value = mediaUrl;
      if (statusEl) statusEl.textContent = "Done";
    } catch {
      if (statusEl) statusEl.textContent = "Upload failed";
    }
  });

  fileInput.click();
}

// ---------------------------------------------------------------------------
// Modal helpers
// ---------------------------------------------------------------------------

function openModal(title: string): void {
  modalTitle.textContent = title;
  modalBody.innerHTML = "";
  modalOverlay.classList.remove("hidden");
}

function closeModal(): void {
  modalOverlay.classList.add("hidden");
  state.activeModal = null;
  state.editingEventId = null;
}

modalCloseBtn.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

// ---------------------------------------------------------------------------
// Delegated listener for edit/delete buttons in event cards
// ---------------------------------------------------------------------------

eventsContainer.addEventListener("click", (e) => {
  const btn = (e.target as Element).closest("[data-action]") as HTMLElement | null;
  if (!btn) return;
  const action = btn.dataset["action"];
  const eventId = btn.dataset["eventId"] ?? "";
  e.stopPropagation();
  if (action === "edit") openEditEventModal(eventId);
  else if (action === "delete") void deleteEvent(eventId);
});

// ---------------------------------------------------------------------------
// Event form
// ---------------------------------------------------------------------------

export function openAddEventModal(): void {
  state.activeModal = "addEvent";
  state.editingEventId = null;
  const today = todayString();
  const defaults: CalendarEvent = {
    id: generateId(),
    title: "",
    description: "",
    link: "",
    dateBegin: today,
    dateEnd: today,
    hourBegin: "",
    hourEnd: "",
    backgroundColor: "#101720",
    foregroundColor: "#F0FFF0",
  };
  openModal("Add Event");
  renderEventForm(defaults, false);
}

export function openEditEventModal(eventId: string): void {
  const event = state.events[eventId];
  if (!event) return;
  state.activeModal = "editEvent";
  state.editingEventId = eventId;
  openModal("Edit Event");
  renderEventForm(event, true);
}

function renderEventForm(event: CalendarEvent, isEdit: boolean): void {
  modalBody.innerHTML = "";

  if (isEdit) {
    const idNote = document.createElement("p");
    idNote.className = "form-id-note";
    idNote.textContent = `ID: ${event.id}`;
    modalBody.appendChild(idNote);
  }

  const fields: Array<{
    id: string;
    label: string;
    type: string;
    value: string;
    required?: boolean;
    placeholder?: string;
  }> = [
    {
      id: "f-title",
      label: "Title *",
      type: "text",
      value: event.title,
      required: true,
    },
    {
      id: "f-description",
      label: "Description",
      type: "textarea",
      value: event.description,
      placeholder: "Optional",
    },
    {
      id: "f-link",
      label: "Link",
      type: "url",
      value: event.link,
      placeholder: "https://…",
    },
    {
      id: "f-dateBegin",
      label: "Start Date *",
      type: "date",
      value: event.dateBegin,
      required: true,
    },
    {
      id: "f-dateEnd",
      label: "End Date *",
      type: "date",
      value: event.dateEnd,
      required: true,
    },
    {
      id: "f-hourBegin",
      label: "Start Time",
      type: "text",
      value: event.hourBegin,
      placeholder: "e.g. 2:00 PM",
    },
    {
      id: "f-hourEnd",
      label: "End Time",
      type: "text",
      value: event.hourEnd,
      placeholder: "e.g. 4:00 PM",
    },
    {
      id: "f-backgroundColor",
      label: "Background Color",
      type: "text",
      value: event.backgroundColor,
      placeholder: "#101720",
    },
    {
      id: "f-foregroundColor",
      label: "Text Color",
      type: "text",
      value: event.foregroundColor,
      placeholder: "#F0FFF0",
    },
  ];

  for (const field of fields) {
    const group = document.createElement("div");
    group.className = "form-group";

    const label = document.createElement("label");
    label.className = "form-label";
    label.htmlFor = field.id;
    label.textContent = field.label;
    group.appendChild(label);

    if (field.type === "textarea") {
      const input = document.createElement("textarea");
      input.className = "form-input";
      input.id = field.id;
      input.value = field.value;
      if (field.placeholder) input.placeholder = field.placeholder;
      group.appendChild(input);
    } else {
      const input = document.createElement("input");
      input.className = "form-input";
      input.id = field.id;
      input.type = field.type === "date" ? "text" : field.type;
      input.value = field.value;
      if (field.placeholder) input.placeholder = field.placeholder;
      if (field.required) input.required = true;
      group.appendChild(input);
    }

    modalBody.appendChild(group);
  }

  const errorEl = document.createElement("div");
  errorEl.className = "form-error hidden";
  errorEl.id = "form-error";
  modalBody.appendChild(errorEl);

  const actions = document.createElement("div");
  actions.className = "form-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn btn-secondary";
  cancelBtn.type = "button";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", closeModal);

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-primary";
  saveBtn.type = "button";
  saveBtn.textContent = isEdit ? "Save Changes" : "Add Event";
  saveBtn.addEventListener("click", () => void submitEventForm(event.id, isEdit, saveBtn));

  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  modalBody.appendChild(actions);
}

function getFormValue(id: string): string {
  const el = document.getElementById(id) as
    | HTMLInputElement
    | HTMLTextAreaElement
    | null;
  return el ? el.value.trim() : "";
}

async function submitEventForm(
  originalId: string,
  isEdit: boolean,
  saveBtn: HTMLButtonElement,
): Promise<void> {
  const errorEl = document.getElementById("form-error") as HTMLDivElement;

  const draft: CalendarEvent = {
    id: isEdit ? originalId : generateId(),
    title: getFormValue("f-title"),
    description: getFormValue("f-description"),
    link: getFormValue("f-link"),
    dateBegin: getFormValue("f-dateBegin"),
    dateEnd: getFormValue("f-dateEnd"),
    hourBegin: getFormValue("f-hourBegin"),
    hourEnd: getFormValue("f-hourEnd"),
    backgroundColor: getFormValue("f-backgroundColor"),
    foregroundColor: getFormValue("f-foregroundColor"),
  };

  const validationError = validateEvent(draft);
  if (validationError) {
    errorEl.textContent = validationError;
    errorEl.classList.remove("hidden");
    return;
  }
  errorEl.classList.add("hidden");

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  try {
    const response = await fetch(ApiEndpoint.SaveEvent, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: draft } satisfies SaveEventRequest),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    (await response.json()) as SaveEventResponse;

    state.events[draft.id] = draft;
    closeModal();
    showToast(isEdit ? "Event updated successfully" : "Event added successfully");
    render();
  } catch (err) {
    errorEl.textContent = `Save failed: ${err instanceof Error ? err.message : String(err)}`;
    errorEl.classList.remove("hidden");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = isEdit ? "Save Changes" : "Add Event";
  }
}

// ---------------------------------------------------------------------------
// Delete event
// ---------------------------------------------------------------------------

async function deleteEvent(eventId: string): Promise<void> {
  try {
    const response = await fetch(ApiEndpoint.DeleteEvent, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId } satisfies DeleteEventRequest),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    (await response.json()) as DeleteEventResponse;

    delete state.events[eventId];
    showToast("Event removed");
    render();
  } catch (err) {
    showToast(
      `Delete failed: ${err instanceof Error ? err.message : String(err)}`,
      true,
    );
  }
}

// ---------------------------------------------------------------------------
// Background image form
// ---------------------------------------------------------------------------

export function openSettingsModal(): void {
  state.activeModal = "settings";
  openModal("Settings");

  // Calendar title field
  const titleGroup = document.createElement("div");
  titleGroup.className = "form-group";

  const titleLabel = document.createElement("label");
  titleLabel.className = "form-label";
  titleLabel.htmlFor = "f-cal-title";
  titleLabel.textContent = "Calendar Title";
  titleGroup.appendChild(titleLabel);

  const titleInput = document.createElement("input");
  titleInput.className = "form-input";
  titleInput.id = "f-cal-title";
  titleInput.type = "text";
  titleInput.placeholder = "Community Calendar";
  titleInput.value = state.config.calendarTitle;
  titleGroup.appendChild(titleInput);

  modalBody.appendChild(titleGroup);

  // Background image field
  const bgGroup = document.createElement("div");
  bgGroup.className = "form-group";

  const bgLabel = document.createElement("label");
  bgLabel.className = "form-label";
  bgLabel.htmlFor = "f-bg-url";
  bgLabel.textContent = "Background Image URL";
  bgGroup.appendChild(bgLabel);

  const inputRow = document.createElement("div");
  inputRow.className = "input-with-action";

  const input = document.createElement("input");
  input.className = "form-input";
  input.id = "f-bg-url";
  input.type = "url";
  input.placeholder = "https://…";
  input.value = state.config.backgroundImageUrl;
  inputRow.appendChild(input);

  const pickBtn = document.createElement("button");
  pickBtn.className = "btn btn-secondary";
  pickBtn.type = "button";
  pickBtn.textContent = "Choose file";
  pickBtn.addEventListener("click", () => pickAndUploadImage("f-bg-url", "f-bg-url-status"));
  inputRow.appendChild(pickBtn);

  bgGroup.appendChild(inputRow);

  const statusEl = document.createElement("span");
  statusEl.className = "input-status";
  statusEl.id = "f-bg-url-status";
  bgGroup.appendChild(statusEl);

  modalBody.appendChild(bgGroup);

  const errorEl = document.createElement("div");
  errorEl.className = "form-error hidden";
  errorEl.id = "bg-form-error";
  modalBody.appendChild(errorEl);

  const actions = document.createElement("div");
  actions.className = "form-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn btn-secondary";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", closeModal);

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-primary";
  saveBtn.textContent = "Save";
  saveBtn.addEventListener("click", () => void submitSettingsForm());

  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  modalBody.appendChild(actions);
}

async function submitSettingsForm(): Promise<void> {
  const calTitleInput = document.getElementById("f-cal-title") as HTMLInputElement;
  const bgInput = document.getElementById("f-bg-url") as HTMLInputElement;
  const errorEl = document.getElementById("bg-form-error") as HTMLDivElement;

  const newConfig: CalendarConfig = {
    ...state.config,
    calendarTitle: calTitleInput.value.trim() || "Community Calendar",
    backgroundImageUrl: bgInput.value.trim(),
  };

  try {
    const response = await fetch(ApiEndpoint.SaveConfig, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: newConfig } satisfies SaveConfigRequest),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    (await response.json()) as SaveConfigResponse;

    state.config = newConfig;
    closeModal();
    showToast("Settings saved");
    render();
  } catch (err) {
    errorEl.textContent = `Save failed: ${err instanceof Error ? err.message : String(err)}`;
    errorEl.classList.remove("hidden");
  }
}
