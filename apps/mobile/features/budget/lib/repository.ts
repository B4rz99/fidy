import { and, eq, isNull } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { budgets } from "@/shared/db";

export type BudgetRow = typeof budgets.$inferInsert;

export function insertBudget(db: AnyDb, row: BudgetRow) {
  db.insert(budgets)
    .values(row)
    .onConflictDoUpdate({
      target: [budgets.userId, budgets.categoryId, budgets.month],
      set: {
        id: row.id,
        amountCents: row.amountCents,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: null,
      },
    })
    .run();
}

export function getBudgetsForMonth(db: AnyDb, userId: string, month: string) {
  return db
    .select()
    .from(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.month, month), isNull(budgets.deletedAt)))
    .all();
}

export function getBudgetById(db: AnyDb, id: string) {
  const rows = db.select().from(budgets).where(eq(budgets.id, id)).all();
  return rows[0] ?? null;
}

export function updateBudgetAmount(db: AnyDb, id: string, amountCents: number, now: string) {
  db.update(budgets).set({ amountCents, updatedAt: now }).where(eq(budgets.id, id)).run();
}

export function softDeleteBudget(db: AnyDb, id: string, now: string) {
  db.update(budgets).set({ deletedAt: now, updatedAt: now }).where(eq(budgets.id, id)).run();
}

export function copyBudgetsToMonth(
  db: AnyDb,
  userId: string,
  sourceMonth: string,
  targetMonth: string,
  now: string,
  generateId: () => string
): string[] {
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
        amountCents: b.amountCents,
        month: targetMonth,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
      return newId;
    });
}
