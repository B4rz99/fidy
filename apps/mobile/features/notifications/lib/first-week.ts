import { differenceInDays } from "date-fns";

export function isFirstWeek(accountCreatedAt: string, now: Date): boolean {
  if (!accountCreatedAt) return false;
  return differenceInDays(now, new Date(accountCreatedAt)) < 7;
}
