import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-sqlite", () => ({
  openDatabaseSync: vi.fn(() => ({ execSync: vi.fn(), closeSync: vi.fn() })),
}));

vi.mock("drizzle-orm/expo-sqlite", () => ({
  drizzle: vi.fn((sqliteDb: unknown) => ({ _: "drizzle-instance", sqliteDb })),
}));

vi.mock("expo-secure-store", () => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

vi.mock("expo-crypto", () => ({
  getRandomBytes: vi.fn(() => new Uint8Array(32)),
}));

vi.mock("@/shared/lib/sentry", () => ({
  captureError: vi.fn(),
}));

import { openDatabaseSync } from "expo-sqlite";
import { getItem, setItem, deleteItemAsync } from "expo-secure-store";
import { getRandomBytes } from "expo-crypto";
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

  it("generates and stores a random encryption key on first call", () => {
    getDb("user-123");
    expect(getRandomBytes).toHaveBeenCalledWith(32);
    expect(setItem).toHaveBeenCalledWith(
      "fidy-db-key-user-123",
      expect.stringMatching(/^[0-9a-f]{64}$/),
    );
  });

  it("reuses stored key from SecureStore on subsequent init", () => {
    const storedKey = "ab".repeat(32);
    vi.mocked(getItem).mockReturnValueOnce(storedKey);

    getDb("user-123");
    expect(getRandomBytes).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("uses raw hex PRAGMA key syntax", () => {
    const mockExecSync = vi.fn();
    vi.mocked(openDatabaseSync).mockReturnValueOnce({
      execSync: mockExecSync,
      closeSync: vi.fn(),
    } as unknown as ReturnType<typeof openDatabaseSync>);

    getDb("user-123");
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringMatching(/^PRAGMA key = "x'[0-9a-f]{64}'"$/),
    );
  });

  it("uses separate SecureStore keys per userId", () => {
    getDb("user-123");
    resetDb();
    vi.clearAllMocks();
    getDb("user-456");

    expect(getItem).toHaveBeenCalledWith("fidy-db-key-user-456");
  });

  it("resetDb does not delete encryption key", () => {
    getDb("user-123");
    resetDb();
    expect(deleteItemAsync).not.toHaveBeenCalled();
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

  it("auto-resets when called with a different userId", () => {
    const mockCloseSync = vi.fn();
    vi.mocked(openDatabaseSync).mockReturnValueOnce({
      execSync: vi.fn(),
      closeSync: mockCloseSync,
    } as unknown as ReturnType<typeof openDatabaseSync>);

    getDb("user-123");
    const db2 = getDb("user-456");

    expect(mockCloseSync).toHaveBeenCalled();
    expect(db2).toBeDefined();
    expect(openDatabaseSync).toHaveBeenCalledWith("fidy-user-456.db");
  });
});
