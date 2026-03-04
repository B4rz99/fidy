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
