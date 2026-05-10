export function clampDateToToday(date: Date, today = new Date()): Date {
  return date > today ? today : date;
}
