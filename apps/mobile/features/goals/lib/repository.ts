import { and, desc, eq, isNull, sql, sum } from "drizzle-orm";
import type { AnyDb } from "@/shared/db/client";
import { goalContributions, goals } from "@/shared/db/schema";

export type GoalRow = typeof goals.$inferInsert;
export type GoalContributionRow = typeof goalContributions.$inferInsert;

// --- Goals CRUD ---

export function getGoalsForUser(db: AnyDb, userId: string) {
  return db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), isNull(goals.deletedAt)))
    .all();
}

// --- Contributions CRUD ---

export function getContributionsForGoal(db: AnyDb, goalId: string) {
  return db
    .select()
    .from(goalContributions)
    .where(and(eq(goalContributions.goalId, goalId), isNull(goalContributions.deletedAt)))
    .orderBy(desc(goalContributions.date))
    .all();
}

// --- Aggregation ---

/** Get the current total contributions for a goal (SUM of non-deleted contributions). */
export function getGoalCurrentAmount(db: AnyDb, goalId: string): number {
  const row = db
    .select({
      total: sum(goalContributions.amount).mapWith(Number),
    })
    .from(goalContributions)
    .where(and(eq(goalContributions.goalId, goalId), isNull(goalContributions.deletedAt)))
    .get();
  return row?.total ?? 0;
}

/** Count distinct months with contributions for a goal. */
export function getContributionMonthCount(db: AnyDb, goalId: string): number {
  const row = db
    .select({
      count: sql<number>`COUNT(DISTINCT strftime('%Y-%m', ${goalContributions.date}))`,
    })
    .from(goalContributions)
    .where(and(eq(goalContributions.goalId, goalId), isNull(goalContributions.deletedAt)))
    .get();
  return row?.count ?? 0;
}
