import type { CalendarEvent } from "./api.ts";

export function parseTimeToMinutes(s: string): number | null {
  if (!s) return null;
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

  return null;
}

export function isValidTimeZone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function todayStringInZone(tz?: string): string {
  try {
    return new Date().toLocaleDateString("sv-SE", tz ? { timeZone: tz } : {}); // YYYY-MM-DD
  } catch {
    return new Date().toLocaleDateString("sv-SE");
  }
}

function tzOffsetMinutes(epochMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(epochMs);
  const num = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  let hour = num("hour");
  if (hour === 24) hour = 0; // hour12:false can yield "24" at midnight
  const asUTC = Date.UTC(
    num("year"),
    num("month") - 1,
    num("day"),
    hour,
    num("minute"),
    num("second"),
  );
  return Math.round((asUTC - epochMs) / 60000);
}

// Epoch ms of the wall-clock moment (dateStr "YYYY-MM-DD" + minutes since
// midnight) in the given IANA zone. Nonexistent spring-forward times and
// ambiguous fall-back times resolve to a deterministic nearby instant.
export function zonedTimeToEpochMs(
  dateStr: string,
  minutes: number,
  tz: string,
): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const wallAsUTC = Date.UTC(
    y ?? 1970,
    (m ?? 1) - 1,
    d ?? 1,
    Math.floor(minutes / 60),
    minutes % 60,
  );
  const guess = wallAsUTC - tzOffsetMinutes(wallAsUTC, tz) * 60000;
  return wallAsUTC - tzOffsetMinutes(guess, tz) * 60000;
}

// Start/end instants for an event, or null when it has no usable timezone or
// no parseable start time (date-only events are calendar dates, not instants).
export function resolveEventInstants(
  event: Pick<
    CalendarEvent,
    "timezone" | "dateBegin" | "dateEnd" | "hourBegin" | "hourEnd"
  >,
): { startMs: number; endMs: number } | null {
  const tz = event.timezone ?? "";
  if (!isValidTimeZone(tz)) return null;

  const beginMinutes = parseTimeToMinutes(event.hourBegin);
  if (beginMinutes === null) return null;
  const startMs = zonedTimeToEpochMs(event.dateBegin, beginMinutes, tz);

  const endMinutes = parseTimeToMinutes(event.hourEnd);
  if (endMinutes === null) return { startMs, endMs: startMs + 60 * 60000 };

  let endMs = zonedTimeToEpochMs(event.dateEnd, endMinutes, tz);
  if (endMs <= startMs) endMs += 24 * 60 * 60000; // overnight, e.g. 11 PM – 1 AM
  return { startMs, endMs };
}
