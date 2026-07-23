import type { CalendarEvent } from "../shared/api.ts";
import {
  parseTimeToMinutes,
  isValidTimeZone,
  resolveEventInstants,
} from "../shared/time.ts";

export { parseTimeToMinutes };

export function todayString(): string {
  return new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD local
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
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

export function isValidHex(s: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(s);
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
  if (data.backgroundColor && !isValidHex(data.backgroundColor))
    return "Background color must be a valid hex color (e.g. #FF0000).";
  if (data.foregroundColor && !isValidHex(data.foregroundColor))
    return "Foreground color must be a valid hex color (e.g. #FFFFFF).";
  return null;
}
