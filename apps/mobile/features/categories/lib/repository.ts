import { and, eq, isNull } from "drizzle-orm";
import type { AnyDb } from "@/shared/db/client";
import { categoryColorOverrides, categoryIconOverrides, userCategories } from "@/shared/db/schema";
import type { UserId } from "@/shared/types/branded";

export type UserCategoryRow = typeof userCategories.$inferInsert;
export type CategoryIconOverrideRow = typeof categoryIconOverrides.$inferInsert;
export type CategoryColorOverrideRow = typeof categoryColorOverrides.$inferInsert;

export function getUserCategoriesForUser(db: AnyDb, userId: UserId) {
  return db
    .select()
    .from(userCategories)
    .where(and(eq(userCategories.userId, userId), isNull(userCategories.deletedAt)))
    .all();
}

export function getCategoryIconOverridesForUser(db: AnyDb, userId: UserId) {
  return db
    .select()
    .from(categoryIconOverrides)
    .where(and(eq(categoryIconOverrides.userId, userId), isNull(categoryIconOverrides.deletedAt)))
    .all();
}

export function getCategoryColorOverridesForUser(db: AnyDb, userId: UserId) {
  return db
    .select()
    .from(categoryColorOverrides)
    .where(and(eq(categoryColorOverrides.userId, userId), isNull(categoryColorOverrides.deletedAt)))
    .all();
}
