// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getAccountSuggestionDismissalsForUser,
  saveAccountSuggestionDismissal,
} from "@/features/account-suggestions/lib/dismissals-repository";
import type { AccountSuggestionDismissalId, IsoDateTime, UserId } from "@/shared/types/branded";

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

const USER_ID = "user-1" as UserId;

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
});

afterEach(() => {
  sqlite.close();
});

const dismissal = (overrides: Record<string, unknown> = {}) => ({
  id: "dismissal-1" as AccountSuggestionDismissalId,
  userId: USER_ID,
  scope: "merchant",
  value: "rappi",
  dismissedScore: 8,
  createdAt: "2026-04-19T10:00:00.000Z" as IsoDateTime,
  updatedAt: "2026-04-19T10:00:00.000Z" as IsoDateTime,
  deletedAt: null,
  ...overrides,
});

describe("account suggestion dismissals repository", () => {
  it("persists a new dismissal", () => {
    saveAccountSuggestionDismissal(db as any, dismissal());
    expect(getAccountSuggestionDismissalsForUser(db as any, USER_ID)).toEqual([
      expect.objectContaining({ id: "dismissal-1", dismissedScore: 8 }),
    ]);
  });

  it("preserves the existing duplicate id when saving a matching dismissal", () => {
    saveAccountSuggestionDismissal(db as any, dismissal());
    saveAccountSuggestionDismissal(
      db as any,
      dismissal({
        id: "dismissal-2",
        dismissedScore: 10,
        updatedAt: "2026-04-19T11:00:00.000Z" as IsoDateTime,
      })
    );

    expect(getAccountSuggestionDismissalsForUser(db as any, USER_ID)).toEqual([
      expect.objectContaining({ id: "dismissal-1", dismissedScore: 10 }),
    ]);
  });
});
