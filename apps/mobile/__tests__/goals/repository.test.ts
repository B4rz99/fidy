// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getContributionById,
  getContributionMonthCount,
  getContributionsForGoal,
  getGoalById,
  getGoalCurrentAmount,
  getGoalsForUser,
  insertContribution,
  insertGoal,
  softDeleteContribution,
  softDeleteGoal,
  updateGoal,
} from "@/features/goals";

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

const USER_ID = "user-1";
const CREATED_AT = "2026-03-01T00:00:00.000Z";
const DELETED_AT = "2026-03-15T09:30:00.000Z";

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
});

afterEach(() => {
  sqlite.close();
});

const insertGoalRow = (
  overrides: Partial<{
    id: string;
    userId: string;
    name: string;
    type: string;
    targetAmount: number;
    targetDate: string | null;
  }> = {}
) =>
  insertGoal(db as any, {
    id: overrides.id ?? "goal-1",
    userId: overrides.userId ?? USER_ID,
    name: overrides.name ?? "Emergency fund",
    type: overrides.type ?? "savings",
    targetAmount: overrides.targetAmount ?? 500000,
    targetDate: overrides.targetDate ?? "2026-12-31",
    interestRatePercent: null,
    iconName: "wallet",
    colorHex: "#0F766E",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    deletedAt: null,
  });

const insertContributionRow = (
  overrides: Partial<{
    id: string;
    goalId: string;
    userId: string;
    amount: number;
    note: string | null;
    date: string;
  }> = {}
) =>
  insertContribution(db as any, {
    id: overrides.id ?? "contribution-1",
    goalId: overrides.goalId ?? "goal-1",
    userId: overrides.userId ?? USER_ID,
    amount: overrides.amount ?? 100000,
    note: overrides.note ?? "monthly transfer",
    date: overrides.date ?? "2026-01-05",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    deletedAt: null,
  });

describe("goals repository", () => {
  it("builds an active contribution summary for a goal", () => {
    insertGoalRow();
    insertGoalRow({
      id: "goal-2",
      name: "Vacation",
      targetAmount: 1500000,
      targetDate: "2026-09-01",
    });

    insertContributionRow({
      id: "contribution-1",
      goalId: "goal-1",
      amount: 100000,
      date: "2026-01-05",
    });
    insertContributionRow({
      id: "contribution-2",
      goalId: "goal-1",
      amount: 150000,
      date: "2026-02-10",
    });
    insertContributionRow({
      id: "contribution-3",
      goalId: "goal-1",
      amount: 50000,
      date: "2026-02-20",
    });
    insertContributionRow({
      id: "contribution-4",
      goalId: "goal-2",
      amount: 999999,
      date: "2026-02-15",
    });

    expect(getGoalsForUser(db as any, USER_ID)).toHaveLength(2);
    expect(getGoalById(db as any, "goal-1")).toMatchObject({
      id: "goal-1",
      name: "Emergency fund",
    });
    expect(getContributionById(db as any, "contribution-2")).toMatchObject({
      id: "contribution-2",
      goalId: "goal-1",
      amount: 150000,
    });

    softDeleteContribution(db as any, "contribution-3", DELETED_AT);

    expect(getContributionsForGoal(db as any, "goal-1").map(({ id }) => id)).toEqual([
      "contribution-2",
      "contribution-1",
    ]);
    expect(getGoalCurrentAmount(db as any, "goal-1")).toBe(250000);
    expect(getContributionMonthCount(db as any, "goal-1")).toBe(2);
  });

  it("applies partial goal updates without overwriting omitted fields", () => {
    insertGoalRow({
      id: "goal-1",
      name: "Emergency fund",
      targetAmount: 500000,
      targetDate: "2026-12-31",
    });

    updateGoal(
      db as any,
      "goal-1",
      {
        name: "Renovation fund",
        targetAmount: 750000,
        colorHex: "#1D4ED8",
        targetDate: null,
      },
      "2026-04-01T12:00:00.000Z"
    );

    expect(getGoalById(db as any, "goal-1")).toMatchObject({
      id: "goal-1",
      name: "Renovation fund",
      type: "savings",
      targetAmount: 750000,
      targetDate: null,
      interestRatePercent: null,
      iconName: "wallet",
      colorHex: "#1D4ED8",
      createdAt: CREATED_AT,
      updatedAt: "2026-04-01T12:00:00.000Z",
      deletedAt: null,
    });
  });

  it("soft deletes a goal so it disappears from active listings but remains queryable by id", () => {
    insertGoalRow({
      id: "goal-1",
      name: "Emergency fund",
    });
    insertGoalRow({
      id: "goal-2",
      name: "Vacation",
    });

    softDeleteGoal(db as any, "goal-1", DELETED_AT);

    expect(getGoalsForUser(db as any, USER_ID).map(({ id }) => id)).toEqual(["goal-2"]);
    expect(getGoalById(db as any, "goal-1")).toMatchObject({
      id: "goal-1",
      deletedAt: DELETED_AT,
      updatedAt: DELETED_AT,
    });
  });
});
