export function cleanUsername(raw: string): string {
  return raw.trim().replace(/^u\//i, '').trim();
}

export function cleanDateInput(raw: string | undefined): string | undefined {
  const trimmed = (raw ?? '').trim().replace(/(\d)[T\s]+(\d)/, '$1 $2');
  return trimmed === '' ? undefined : trimmed;
}

export function isValidDateTimeString(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})( (\d{2}):(\d{2}))?$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    return false;
  }
  if (m[4] && (Number(m[5]) > 23 || Number(m[6]) > 59)) return false;
  return true;
}

/** Expand a stored bound to full "YYYY-MM-DD HH:MM" resolution. */
function normalizeBound(s: string, defaultTime: '00:00' | '23:59'): string {
  return s.length === 10 ? `${s} ${defaultTime}` : s;
}

export type PeriodStatus = 'active' | 'scheduled' | 'expired';

/** Minute-resolution inclusive UTC comparison; date-only bounds cover their whole day; absent bounds are open. */
export function getPeriodStatus(
  c: { activeFrom?: string; activeUntil?: string },
  now: Date = new Date()
): PeriodStatus {
  const nowStr = now.toISOString().slice(0, 16).replace('T', ' ');
  if (c.activeFrom && nowStr < normalizeBound(c.activeFrom, '00:00')) return 'scheduled';
  if (c.activeUntil && nowStr > normalizeBound(c.activeUntil, '23:59')) return 'expired';
  return 'active';
}

/** Among same-rule matches, templates with an active period set outrank always-active ones. */
export function filterPreferringPeriod<T extends { activeFrom?: string; activeUntil?: string }>(
  matches: T[]
): T[] {
  const withPeriod = matches.filter((c) => c.activeFrom || c.activeUntil);
  return withPeriod.length > 0 ? withPeriod : matches;
}

/** Returns an error message, or null if the period inputs are valid. */
export function validatePeriodInputs(activeFrom?: string, activeUntil?: string): string | null {
  if (activeFrom && !isValidDateTimeString(activeFrom)) {
    return 'Active from must be a date (YYYY-MM-DD) or date and time (YYYY-MM-DD HH:MM, 24-hour UTC), e.g. 2026-07-08 or 2026-07-08 14:30.';
  }
  if (activeUntil && !isValidDateTimeString(activeUntil)) {
    return 'Active until must be a date (YYYY-MM-DD) or date and time (YYYY-MM-DD HH:MM, 24-hour UTC), e.g. 2026-07-08 or 2026-07-08 14:30.';
  }
  if (
    activeFrom &&
    activeUntil &&
    normalizeBound(activeFrom, '00:00') > normalizeBound(activeUntil, '23:59')
  ) {
    return 'Active from must be on or before active until.';
  }
  return null;
}
