import { addMonths, subMonths } from "date-fns";
import { toMonth } from "@/shared/lib";
import type { Month } from "@/shared/types/branded";

export const formatBudgetMonth = (date: Date): Month => toMonth(date);

/** Parse "YYYY-MM" to a local-time Date (1st of month). Avoids UTC date-only parsing pitfall. */
const parseBudgetMonth = (month: Month): Date => {
  const parts = month.split("-").map(Number);
  const year = parts[0] ?? 0;
  const monthIndex = (parts[1] ?? 1) - 1;
  return new Date(year, monthIndex, 1);
};

export const nextBudgetMonth = (month: Month): Month =>
  formatBudgetMonth(addMonths(parseBudgetMonth(month), 1));

export const previousBudgetMonth = (month: Month): Month =>
  formatBudgetMonth(subMonths(parseBudgetMonth(month), 1));
