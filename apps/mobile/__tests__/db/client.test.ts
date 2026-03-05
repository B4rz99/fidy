import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({
  openDatabaseSync: vi.fn(() => ({ execSync: vi.fn(), closeSync: vi.fn() })),
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

  it("returns a drizzle instance for a given userId", () => {
    const db = getDb("user-123");
    expect(db).toBeDefined();
    expect(db).toHaveProperty("_", "drizzle-instance");
  });

  it("returns the same instance on subsequent calls with same userId", () => {
    const db1 = getDb("user-123");
    const db2 = getDb("user-123");
    expect(db1).toBe(db2);
  });

  it("opens database with user-scoped name", () => {
    getDb("user-123");
    expect(openDatabaseSync).toHaveBeenCalledWith("fidy-user-123.db");
  });

  it("sets SQLCipher encryption key derived from userId", () => {
    const mockExecSync = vi.fn();
    vi.mocked(openDatabaseSync).mockReturnValueOnce({
      execSync: mockExecSync,
      closeSync: vi.fn(),
    } as unknown as ReturnType<typeof openDatabaseSync>);

    getDb("user-123");
    expect(mockExecSync).toHaveBeenCalledWith(expect.stringContaining("PRAGMA key"));
  });

  it("resets and closes the connection on resetDb", () => {
    const mockCloseSync = vi.fn();
    vi.mocked(openDatabaseSync).mockReturnValueOnce({
      execSync: vi.fn(),
      closeSync: mockCloseSync,
    } as unknown as ReturnType<typeof openDatabaseSync>);

    getDb("user-123");
    resetDb();
    expect(mockCloseSync).toHaveBeenCalled();

    getDb("user-456");
    expect(openDatabaseSync).toHaveBeenCalledTimes(2);
  });

  it("throws when called with a different userId without resetDb", () => {
    getDb("user-123");
    expect(() => getDb("user-456")).toThrow("Call resetDb() first");
  });
});
