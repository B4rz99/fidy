/**
 * Converts an ISO date string (YYYY-MM-DD) to display format (DD-MM-YYYY).
 */
export function formatDateDisplay(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}-${month}-${year}`;
}

/**
 * Converts a Date object to an ISO date string (YYYY-MM-DD).
 */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parses an ISO date string (YYYY-MM-DD) into a local Date (midnight local time).
 * Avoids `new Date("YYYY-MM-DD")` which parses as UTC and shifts dates in negative UTC offsets.
 */
export function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}
