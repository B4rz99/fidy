import { eq } from "drizzle-orm";
import type { AnyDb } from "@/shared/db/client";
import { goalContributions, goals } from "@/shared/db/schema";

export type GoalRow = typeof goals.$inferInsert;
export type GoalContributionRow = typeof goalContributions.$inferInsert;

type UpdateGoalInput = {
  readonly db: AnyDb;
  readonly id: string;
  readonly data: {
    name?: string;
    targetAmount?: number;
    targetDate?: string | null;
    interestRatePercent?: number | null;
    iconName?: string | null;
    colorHex?: string | null;
  };
  readonly now: string;
};

export function insertGoal(db: AnyDb, row: GoalRow) {
  db.insert(goals).values(row).run();
}

export function updateGoal(input: UpdateGoalInput) {
  input.db
    .update(goals)
    .set({ ...input.data, updatedAt: input.now })
    .where(eq(goals.id, input.id))
    .run();
}

export function softDeleteGoal(db: AnyDb, id: string, now: string) {
  db.update(goals).set({ deletedAt: now, updatedAt: now }).where(eq(goals.id, id)).run();
}

export function insertContribution(db: AnyDb, row: GoalContributionRow) {
  db.insert(goalContributions).values(row).run();
}

export function softDeleteContribution(db: AnyDb, id: string, now: string) {
  db.update(goalContributions)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(goalContributions.id, id))
    .run();
}
