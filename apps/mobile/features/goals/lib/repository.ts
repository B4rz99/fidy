import { and, desc, eq, isNull, sql, sum } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { goalContributions, goals } from "@/shared/db";

export type GoalRow = typeof goals.$inferInsert;
export type GoalContributionRow = typeof goalContributions.$inferInsert;

// --- Goals CRUD ---

export function insertGoal(db: AnyDb, row: GoalRow) {
  db.insert(goals).values(row).run();
}

export function getGoalsForUser(db: AnyDb, userId: string) {
  return db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), isNull(goals.deletedAt)))
    .all();
}

export function getGoalById(db: AnyDb, id: string) {
  const rows = db.select().from(goals).where(eq(goals.id, id)).all();
  return rows[0] ?? null;
}

export function updateGoal(
  db: AnyDb,
  id: string,
  data: {
    name?: string;
    targetAmount?: number;
    targetDate?: string | null;
    interestRatePercent?: number | null;
    iconName?: string | null;
    colorHex?: string | null;
  },
  now: string
) {
  db.update(goals)
    .set({ ...data, updatedAt: now })
    .where(eq(goals.id, id))
    .run();
}

export function softDeleteGoal(db: AnyDb, id: string, now: string) {
  db.update(goals).set({ deletedAt: now, updatedAt: now }).where(eq(goals.id, id)).run();
}

// --- Contributions CRUD ---

export function insertContribution(db: AnyDb, row: GoalContributionRow) {
  db.insert(goalContributions).values(row).run();
}

export function getContributionById(db: AnyDb, id: string) {
  const rows = db.select().from(goalContributions).where(eq(goalContributions.id, id)).all();
  return rows[0] ?? null;
}

export function getContributionsForGoal(db: AnyDb, goalId: string) {
  return db
    .select()
    .from(goalContributions)
    .where(and(eq(goalContributions.goalId, goalId), isNull(goalContributions.deletedAt)))
    .orderBy(desc(goalContributions.date))
    .all();
}

export function softDeleteContribution(db: AnyDb, id: string, now: string) {
  db.update(goalContributions)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(goalContributions.id, id))
    .run();
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
