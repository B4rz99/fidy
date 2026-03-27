import type { IsoDate, IsoDateTime, Month } from "@/shared/types/branded";

/**
 * Converts an ISO date string (YYYY-MM-DD) to display format (DD-MM-YYYY).
 */
export function formatDateDisplay(isoDate: IsoDate): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}-${month}-${year}`;
}

/**
 * Converts a Date object to an ISO date string (YYYY-MM-DD).
 */
export function toIsoDate(date: Date): IsoDate {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` as IsoDate;
}

/**
 * Parses an ISO date string (YYYY-MM-DD) into a local Date (midnight local time).
 * Avoids `new Date("YYYY-MM-DD")` which parses as UTC and shifts dates in negative UTC offsets.
 */
export function parseIsoDate(isoDate: IsoDate): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Converts a Date object to a month string (YYYY-MM).
 */
export function toMonth(date: Date): Month {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}` as Month;
}

/**
 * Converts a Date object to a full ISO 8601 datetime string.
 */
export function toIsoDateTime(date: Date): IsoDateTime {
  return date.toISOString() as IsoDateTime;
}

/**
 * Returns a Date offset by `days` relative to `base` (negative = in the past).
 */
export function offsetDate(base: Date, days: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
}
