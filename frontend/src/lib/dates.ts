/** All times are shown in Myanmar Time (UTC+06:30), wherever the viewer is. */
export const TIME_ZONE = "Asia/Yangon";
const OFFSET = "+06:30";

const dayFormat = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short" });
const timeFormat = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" });
const keyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const inputFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * Formats a date as a short day, e.g. "Tue 13 Oct".
 *
 * @param iso - ISO date string or Date.
 * @returns The formatted day.
 */
export function formatDay(iso: string | Date): string {
  return dayFormat.format(new Date(iso)).replace(",", "");
}

/**
 * Formats a time, e.g. "1:00 PM".
 *
 * @param iso - ISO date string or Date.
 * @returns The formatted time.
 */
export function formatTime(iso: string | Date): string {
  return timeFormat.format(new Date(iso));
}

/**
 * Formats day and time, e.g. "Tue 13 Oct · 1:00 PM".
 *
 * @param iso - ISO date string or Date.
 * @returns The formatted date and time.
 */
export function formatDateTime(iso: string | Date): string {
  return `${formatDay(iso)} · ${formatTime(iso)}`;
}

/**
 * Returns the Myanmar calendar date, e.g. "2026-10-13", for grouping by day.
 *
 * @param iso - ISO date string or Date.
 * @returns The date key.
 */
export function dayKey(iso: string | Date): string {
  return keyFormat.format(new Date(iso));
}

/**
 * Converts a date to the value a `datetime-local` input expects, in Myanmar Time.
 *
 * @param iso - ISO date string or Date.
 * @returns e.g. "2026-10-20T19:00".
 */
export function toInputValue(iso: string | Date): string {
  const parts = Object.fromEntries(inputFormat.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/**
 * Converts a `datetime-local` input value (Myanmar Time) to an ISO string.
 *
 * @param value - e.g. "2026-10-20T19:00".
 * @returns e.g. "2026-10-20T19:00:00+06:30".
 */
export function fromInputValue(value: string): string {
  return `${value}:00${OFFSET}`;
}

/**
 * Returns the start of a Myanmar calendar day, a number of days from today.
 *
 * @param offsetDays - Days from today (negative for the past).
 * @returns ISO string for 00:00 Myanmar Time on that day.
 */
export function startOfDay(offsetDays: number): string {
  const today = dayKey(new Date());
  const date = new Date(`${today}T00:00:00${OFFSET}`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString();
}
