import { navigateTo } from "@devvit/web/client";
import type { CalendarEvent } from "../shared/api.ts";
import { state } from "./state.ts";
import {
  calTitleEl,
  calHeader,
  bgOverlay,
  modControls,
  editToggleBtn,
  loadingEl,
  emptyStateEl,
  emptyAddHint,
  eventsContainer,
} from "./dom.ts";
import { setToolbarVisible } from "./toolbar.ts";
import { isNowEvent, sortEvents, formatDateRange } from "./utils.ts";

function buildEventCard(event: CalendarEvent): HTMLElement {
  const isLive = isNowEvent(event);
  const isClickable = !!event.link && !state.editMode;

  const card = document.createElement("div");
  card.className = `event-card${isClickable ? " clickable" : ""}`;
  card.style.backgroundColor = event.backgroundColor || "#101720";
  card.style.color = event.foregroundColor || "#F0FFF0";

  if (isClickable) {
    card.addEventListener("click", () => {
      navigateTo(event.link);
    });
  }

  const header = document.createElement("div");
  header.className = "event-card-header";

  const titleRow = document.createElement("div");
  titleRow.className = "event-title-row";

  if (isLive) {
    const badge = document.createElement("span");
    badge.className = "live-badge";
    badge.innerHTML = '<span class="live-dot"></span>LIVE';
    titleRow.appendChild(badge);
  }

  const titleEl = document.createElement("span");
  titleEl.className = "event-title";
  titleEl.textContent = event.title;
  titleRow.appendChild(titleEl);

  header.appendChild(titleRow);

  if (state.editMode) {
    const actions = document.createElement("div");
    actions.className = "event-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-edit";
    editBtn.textContent = "Edit";
    editBtn.dataset["action"] = "edit";
    editBtn.dataset["eventId"] = event.id;

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn btn-danger";
    removeBtn.textContent = "Remove";
    removeBtn.dataset["action"] = "delete";
    removeBtn.dataset["eventId"] = event.id;

    actions.appendChild(editBtn);
    actions.appendChild(removeBtn);
    header.appendChild(actions);
  }

  card.appendChild(header);

  const meta = document.createElement("div");
  meta.className = "event-meta";
  let metaText = formatDateRange(event.dateBegin, event.dateEnd);
  if (event.hourBegin) {
    metaText += ` · ${event.hourBegin}`;
    if (event.hourEnd) metaText += ` – ${event.hourEnd}`;
  }
  meta.textContent = metaText;
  card.appendChild(meta);

  if (event.description) {
    const desc = document.createElement("div");
    desc.className = "event-description";
    desc.textContent = event.description;
    card.appendChild(desc);
  }

  return card;
}

export function render(): void {
  const allEvents = sortEvents(Object.values(state.events));
  const nowEvents = allEvents.filter(isNowEvent);
  const upcomingEvents = allEvents.filter((e) => !isNowEvent(e));
  const combined = [...nowEvents, ...upcomingEvents];

  // Loading hidden once init completes
  loadingEl.classList.add("hidden");

  // Calendar title
  const title = state.config.calendarTitle || "Community Calendar";
  calTitleEl.textContent = title;
  document.title = title;

  // Background
  if (state.config.backgroundImageUrl) {
    bgOverlay.style.backgroundImage = `url(${JSON.stringify(state.config.backgroundImageUrl)})`;
    bgOverlay.classList.add("visible");
  } else {
    bgOverlay.style.backgroundImage = "";
    bgOverlay.classList.remove("visible");
  }

  // Mod controls
  if (state.isModerator) {
    modControls.classList.remove("hidden");
    editToggleBtn.innerHTML = state.editMode ? "&#10003;" : "&#9998;";
    editToggleBtn.classList.toggle("active", state.editMode);
    calHeader.classList.toggle("edit-mode", state.editMode);
    setToolbarVisible(state.editMode);
  } else {
    modControls.classList.add("hidden");
  }

  // Empty state
  if (combined.length === 0) {
    eventsContainer.classList.add("hidden");
    emptyStateEl.classList.remove("hidden");
    emptyAddHint.classList.toggle(
      "hidden",
      !(state.isModerator && !state.editMode),
    );
  } else {
    emptyStateEl.classList.add("hidden");
    eventsContainer.classList.remove("hidden");

    eventsContainer.innerHTML = "";

    if (nowEvents.length > 0) {
      const label = document.createElement("div");
      label.className = "section-label";
      label.textContent = "Happening now";
      eventsContainer.appendChild(label);
      for (const event of nowEvents) {
        eventsContainer.appendChild(buildEventCard(event));
      }
    }

    if (upcomingEvents.length > 0) {
      const label = document.createElement("div");
      label.className = "section-label";
      label.textContent = state.config.titleUpcoming;
      eventsContainer.appendChild(label);
      for (const event of upcomingEvents) {
        eventsContainer.appendChild(buildEventCard(event));
      }
    }
  }

}
