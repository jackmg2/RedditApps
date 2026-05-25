import type { CalendarEvent } from "../shared/api.ts";

export function todayString(): string {
  return new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD local
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function parseTimeToMinutes(s: string): number {
  if (!s) return 0;
  const t = s.trim();

  // HH:MM or H:MM optionally followed by AM/PM
  const colonMatch = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/i.exec(t);
  if (colonMatch) {
    let h = parseInt(colonMatch[1] ?? "0", 10);
    const m = parseInt(colonMatch[2] ?? "0", 10);
    const meridiem = (colonMatch[3] ?? "").toLowerCase();
    if (meridiem === "pm" && h < 12) h += 12;
    if (meridiem === "am" && h === 12) h = 0;
    return h * 60 + m;
  }

  // H AM/PM or HAM/PM  e.g. "2PM", "2 PM"
  const hourMeridiemMatch = /^(\d{1,2})\s*(am|pm)$/i.exec(t);
  if (hourMeridiemMatch) {
    let h = parseInt(hourMeridiemMatch[1] ?? "0", 10);
    const meridiem = (hourMeridiemMatch[2] ?? "").toLowerCase();
    if (meridiem === "pm" && h < 12) h += 12;
    if (meridiem === "am" && h === 12) h = 0;
    return h * 60;
  }

  // Plain hour number e.g. "14"
  const hourOnlyMatch = /^(\d{1,2})$/.exec(t);
  if (hourOnlyMatch) {
    return parseInt(hourOnlyMatch[1] ?? "0", 10) * 60;
  }

  return 0;
}

export function isNowEvent(event: CalendarEvent): boolean {
  const today = todayString();
  if (event.dateBegin !== today) return false;
  if (!event.hourBegin) return true;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const beginMinutes = parseTimeToMinutes(event.hourBegin);
  const endMinutes = event.hourEnd
    ? parseTimeToMinutes(event.hourEnd)
    : beginMinutes + 60;

  return currentMinutes >= beginMinutes && currentMinutes <= endMinutes;
}

export function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    if (a.dateBegin < b.dateBegin) return -1;
    if (a.dateBegin > b.dateBegin) return 1;
    return parseTimeToMinutes(a.hourBegin) - parseTimeToMinutes(b.hourBegin);
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
  if (data.link && !data.link.startsWith("https://"))
    return "Link must start with https:// or be empty.";
  if (data.backgroundColor && !isValidHex(data.backgroundColor))
    return "Background color must be a valid hex color (e.g. #FF0000).";
  if (data.foregroundColor && !isValidHex(data.foregroundColor))
    return "Foreground color must be a valid hex color (e.g. #FFFFFF).";
  return null;
}
