import { and, eq, isNull } from "drizzle-orm";
import type { AnyDb } from "@/shared/db/client";
import { categoryColorOverrides, categoryIconOverrides, userCategories } from "@/shared/db/schema";
import type { CategoryId, IsoDateTime, UserId } from "@/shared/types/branded";

export type UserCategoryRow = typeof userCategories.$inferInsert;
export type CategoryIconOverrideRow = typeof categoryIconOverrides.$inferInsert;
export type CategoryColorOverrideRow = typeof categoryColorOverrides.$inferInsert;

export type ClearCategoryOverrideInput = {
  readonly userId: UserId;
  readonly categoryId: CategoryId;
  readonly now: IsoDateTime;
};

export function insertUserCategory(db: AnyDb, row: UserCategoryRow) {
  db.insert(userCategories).values(row).run();
}

export function upsertCategoryIconOverride(db: AnyDb, row: CategoryIconOverrideRow) {
  db.insert(categoryIconOverrides)
    .values(row)
    .onConflictDoUpdate({
      target: [categoryIconOverrides.userId, categoryIconOverrides.categoryId],
      set: {
        emoji: row.emoji,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      },
    })
    .run();
}

export function clearCategoryIconOverride(db: AnyDb, input: ClearCategoryOverrideInput) {
  const { categoryId, now, userId } = input;

  db.update(categoryIconOverrides)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(categoryIconOverrides.userId, userId),
        eq(categoryIconOverrides.categoryId, categoryId),
        isNull(categoryIconOverrides.deletedAt)
      )
    )
    .run();
}

export function upsertCategoryColorOverride(db: AnyDb, row: CategoryColorOverrideRow) {
  db.insert(categoryColorOverrides)
    .values(row)
    .onConflictDoUpdate({
      target: [categoryColorOverrides.userId, categoryColorOverrides.categoryId],
      set: {
        colorHex: row.colorHex,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      },
    })
    .run();
}

export function clearCategoryColorOverride(db: AnyDb, input: ClearCategoryOverrideInput) {
  const { categoryId, now, userId } = input;

  db.update(categoryColorOverrides)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(categoryColorOverrides.userId, userId),
        eq(categoryColorOverrides.categoryId, categoryId),
        isNull(categoryColorOverrides.deletedAt)
      )
    )
    .run();
}
