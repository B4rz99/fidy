import { and, eq, isNull } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { budgets } from "@/shared/db";
import type { BudgetId, CopAmount, IsoDateTime, Month, UserId } from "@/shared/types/branded";

export type BudgetRow = typeof budgets.$inferInsert;

export function insertBudget(db: AnyDb, row: BudgetRow) {
  db.insert(budgets)
    .values(row)
    .onConflictDoUpdate({
      target: [budgets.userId, budgets.categoryId, budgets.month],
      set: {
        id: row.id,
        amount: row.amount,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: null,
      },
    })
    .run();
}

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

export function updateBudgetAmount(db: AnyDb, id: BudgetId, amount: CopAmount, now: IsoDateTime) {
  db.update(budgets).set({ amount, updatedAt: now }).where(eq(budgets.id, id)).run();
}

export function softDeleteBudget(db: AnyDb, id: BudgetId, now: IsoDateTime) {
  db.update(budgets).set({ deletedAt: now, updatedAt: now }).where(eq(budgets.id, id)).run();
}

export function copyBudgetsToMonth(
  db: AnyDb,
  userId: UserId,
  sourceMonth: Month,
  targetMonth: Month,
  now: IsoDateTime,
  generateId: () => BudgetId
): BudgetId[] {
  const sourceBudgets = getBudgetsForMonth(db, userId, sourceMonth);
  const existingTargetBudgets = getBudgetsForMonth(db, userId, targetMonth);
  const existingCategoryIds = new Set(existingTargetBudgets.map((b) => b.categoryId));

  return sourceBudgets
    .filter((b) => !existingCategoryIds.has(b.categoryId))
    .map((b) => {
      const newId = generateId();
      insertBudget(db, {
        id: newId,
        userId: b.userId,
        categoryId: b.categoryId,
        amount: b.amount,
        month: targetMonth,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
      return newId;
    });
}
