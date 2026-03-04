import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({
  openDatabaseSync: vi.fn(() => ({ execSync: vi.fn() })),
}));

vi.mock("drizzle-orm/expo-sqlite", () => ({
  drizzle: vi.fn((sqliteDb: unknown) => ({ _: "drizzle-instance", sqliteDb })),
}));

import { openDatabaseSync } from "expo-sqlite";
import { getDb, resetDb } from "@/shared/db/client";

describe("getDb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDb();
  });

  it("returns a drizzle instance", () => {
    const db = getDb();
    expect(db).toBeDefined();
    expect(db).toHaveProperty("_", "drizzle-instance");
  });

  it("returns the same instance on subsequent calls (singleton)", () => {
    const db1 = getDb();
    const db2 = getDb();
    expect(db1).toBe(db2);
  });

  it("opens database with correct name", () => {
    getDb();
    expect(openDatabaseSync).toHaveBeenCalledWith("fidy.db");
  });

  it("sets SQLCipher encryption key after opening", () => {
    const mockExecSync = vi.fn();
    vi.mocked(openDatabaseSync).mockReturnValueOnce({
      execSync: mockExecSync,
    } as unknown as ReturnType<typeof openDatabaseSync>);

    getDb();
    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining("PRAGMA key"));
  });
});
