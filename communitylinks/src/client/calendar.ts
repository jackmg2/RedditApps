import type { CalendarEvent, Page } from "../shared/api.ts";
import {
  parseTimeToMinutes,
  isValidTimeZone,
  resolveEventInstants,
  todayStringInZone,
} from "../shared/time.ts";
import { escHtml, newId } from "./helpers.ts";
import { state } from "./state.ts";

// Date/time utilities ported from RedditCalendar (client sharing is by copy).

export { parseTimeToMinutes };

export function todayString(): string {
  return new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD local
}

export function isNowEvent(event: CalendarEvent): boolean {
  const instants = resolveEventInstants(event);
  if (instants) {
    const now = Date.now();
    return now >= instants.startMs && now <= instants.endMs;
  }

  const today = todayString();
  if (event.dateBegin !== today) return false;

  const beginMinutes = parseTimeToMinutes(event.hourBegin);
  if (beginMinutes === null) return true;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const endMinutes = parseTimeToMinutes(event.hourEnd) ?? beginMinutes + 60;

  return currentMinutes >= beginMinutes && currentMinutes <= endMinutes;
}

export function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    const aInstants = resolveEventInstants(a);
    const bInstants = resolveEventInstants(b);
    if (aInstants && bInstants) return aInstants.startMs - bInstants.startMs;
    if (a.dateBegin < b.dateBegin) return -1;
    if (a.dateBegin > b.dateBegin) return 1;
    return (
      (parseTimeToMinutes(a.hourBegin) ?? 0) -
      (parseTimeToMinutes(b.hourBegin) ?? 0)
    );
  });
}

export function formatDate(dateStr: string): string {
  // dateStr is YYYY-MM-DD; append T00:00 so it parses in local time
  const d = new Date(`${dateStr}T00:00`);
  return d.toLocaleDateString(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateRange(dateBegin: string, dateEnd: string): string {
  if (dateBegin === dateEnd) return formatDate(dateBegin);
  return `${formatDate(dateBegin)} – ${formatDate(dateEnd)}`;
}

// Meta line for an event card. Events with a timezone and a parseable start
// time are converted to the viewer's local time; everything else displays the
// stored strings as-is.
export function formatEventWhen(event: CalendarEvent): {
  text: string;
  tooltip?: string;
} {
  const instants = resolveEventInstants(event);
  if (!instants) {
    let text = formatDateRange(event.dateBegin, event.dateEnd);
    if (event.hourBegin) {
      text += ` · ${event.hourBegin}`;
      if (event.hourEnd) text += ` – ${event.hourEnd}`;
    }
    return { text };
  }

  const start = new Date(instants.startMs);
  const end = new Date(instants.endMs);
  const dateOptions = {
    month: "numeric",
    day: "numeric",
    year: "numeric",
  } as const;
  const timeOptions = { hour: "numeric", minute: "2-digit" } as const;
  const hasEnd = parseTimeToMinutes(event.hourEnd) !== null;

  const startDate = start.toLocaleDateString(undefined, dateOptions);
  const endDate = end.toLocaleDateString(undefined, dateOptions);
  let text =
    hasEnd && startDate !== endDate ? `${startDate} – ${endDate}` : startDate;
  text += ` · ${start.toLocaleTimeString(undefined, timeOptions)}`;
  if (hasEnd) text += ` – ${end.toLocaleTimeString(undefined, timeOptions)}`;
  text += " · your time";

  let tooltip = `${event.hourBegin}`;
  if (event.hourEnd) tooltip += ` – ${event.hourEnd}`;
  tooltip += ` ${event.timezone}`;
  return { text, tooltip };
}

export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00`);
  return !isNaN(d.getTime());
}

export function validateEvent(data: Partial<CalendarEvent>): string | null {
  if (!data.title?.trim()) return "Title is required.";
  if (!isValidDate(data.dateBegin ?? ""))
    return "Start date must be a valid YYYY-MM-DD date.";
  if (!isValidDate(data.dateEnd ?? ""))
    return "End date must be a valid YYYY-MM-DD date.";
  if ((data.dateEnd ?? "") < (data.dateBegin ?? ""))
    return "End date must be on or after start date.";
  if (data.timezone && !isValidTimeZone(data.timezone))
    return "Time zone must be a valid time zone.";
  if (
    data.timezone &&
    data.hourBegin &&
    parseTimeToMinutes(data.hourBegin) === null
  )
    return "Start time not recognized — use a format like 2:00 PM.";
  if (data.link && !data.link.startsWith("https://"))
    return "Link must start with https:// or be empty.";
  return null;
}

// Linker-specific helpers

export function isCalendarPage(page: Page): boolean {
  return (page.type ?? "grid") === "calendar";
}

export function getPageEvents(page: Page): CalendarEvent[] {
  return Object.values(page.events ?? {});
}

export function newCalendarEvent(): CalendarEvent {
  const today = todayString();
  return {
    id: newId(),
    title: "",
    description: "",
    link: "",
    dateBegin: today,
    dateEnd: today,
    hourBegin: "",
    hourEnd: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    backgroundColor: "#101720",
    foregroundColor: "#F0FFF0",
  };
}

function isExpired(event: CalendarEvent): boolean {
  // Expire relative to "today" in the event's own timezone so events near the
  // date line aren't hidden early; falls back to viewer-local time.
  return event.dateEnd < todayStringInZone(event.timezone);
}

function renderEventCardHTML(event: CalendarEvent, isEditMode: boolean): string {
  const isLive = isNowEvent(event);
  const clickable = !!event.link && !isEditMode;

  const liveBadge = isLive
    ? `<span class="cal-live-badge"><span class="cal-live-dot"></span>LIVE</span>`
    : "";

  const expiredTag =
    isEditMode && isExpired(event)
      ? `<span class="cal-expired-tag">Expired</span>`
      : "";

  const when = formatEventWhen(event);
  const metaTitle = when.tooltip ? ` title="${escHtml(when.tooltip)}"` : "";

  const description = event.description
    ? `<div class="cal-event-description">${escHtml(event.description)}</div>`
    : "";

  const actions = isEditMode
    ? `<div class="cal-event-actions">
         <button class="btn-secondary" data-action="cal-edit" data-event-id="${escHtml(event.id)}">Edit</button>
         <button class="btn-primary danger" data-action="cal-del" data-event-id="${escHtml(event.id)}">Remove</button>
       </div>`
    : "";

  return `<div class="cal-event-card${clickable ? " clickable" : ""}" data-event-id="${escHtml(event.id)}" data-uri="${escHtml(event.link)}" style="background-color:${escHtml(event.backgroundColor || "#101720")};color:${escHtml(event.foregroundColor || "#F0FFF0")}">
    <div class="cal-event-card-header">
      <div class="cal-event-title-row">${liveBadge}${expiredTag}<span class="cal-event-title">${escHtml(event.title)}</span></div>
    </div>
    <div class="cal-event-meta"${metaTitle}>${escHtml(when.text)}</div>
    ${description}
    ${actions}
  </div>`;
}

export function renderCalendarHTML(page: Page): string {
  const isEditMode = state?.isEditMode ?? false;
  let events = sortEvents(getPageEvents(page));
  if (!isEditMode) {
    events = events.filter((e) => !isExpired(e));
  }
  const nowEvents = events.filter(isNowEvent);
  const upcomingEvents = events.filter((e) => !isNowEvent(e));

  const addBtn = isEditMode
    ? `<button class="btn-secondary cal-add-event-btn" data-action="cal-add">+ Add event</button>`
    : "";

  if (nowEvents.length === 0 && upcomingEvents.length === 0) {
    return `${addBtn}<p class="cal-empty">No upcoming events.</p>`;
  }

  const nowSection =
    nowEvents.length > 0
      ? `<div class="cal-section-label">Happening now</div>` +
        nowEvents.map((e) => renderEventCardHTML(e, isEditMode)).join("")
      : "";

  const upcomingSection =
    upcomingEvents.length > 0
      ? `<div class="cal-section-label">Upcoming</div>` +
        upcomingEvents.map((e) => renderEventCardHTML(e, isEditMode)).join("")
      : "";

  return `${addBtn}${nowSection}${upcomingSection}`;
}
