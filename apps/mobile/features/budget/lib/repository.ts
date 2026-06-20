import { and, eq, isNull } from "drizzle-orm";
import type { AnyDb } from "@/shared/db/client";
import { budgets } from "@/shared/db/schema";
import type { BudgetId, Month, UserId } from "@/shared/types/branded";

export type BudgetRow = typeof budgets.$inferInsert;

export function getBudgetsForMonth(db: AnyDb, userId: UserId, month: Month) {
  return db
    .select()
    .from(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.month, month), isNull(budgets.deletedAt)))
    .all();
}

export function getBudgetById(db: AnyDb, id: BudgetId) {
  const rows = db.select().from(budgets).where(eq(budgets.id, id)).all();
  return rows[0] ?? null;
}
