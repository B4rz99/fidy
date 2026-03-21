import { and, eq, isNull } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { userCategories } from "@/shared/db";
import type { UserId } from "@/shared/types/branded";

export type UserCategoryRow = typeof userCategories.$inferInsert;

export function insertUserCategory(db: AnyDb, row: UserCategoryRow) {
  db.insert(userCategories).values(row).run();
}

export function getUserCategoriesForUser(db: AnyDb, userId: UserId) {
  return db
    .select()
    .from(userCategories)
    .where(and(eq(userCategories.userId, userId), isNull(userCategories.deletedAt)))
    .all();
}
