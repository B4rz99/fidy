import { getRandomBytes } from "expo-crypto";
import { deleteItemAsync, getItem, setItem } from "expo-secure-store";
import { deleteDatabaseAsync, openDatabaseSync } from "expo-sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb, resetDb, resetDbForUser, tryGetDb } from "@/shared/db/client";

vi.mock("expo-sqlite", () => ({
  openDatabaseSync: vi.fn<() => { execSync: () => void; closeSync: () => void }>(() => ({
    execSync: vi.fn<() => void>(),
    closeSync: vi.fn<() => void>(),
  })),
  deleteDatabaseAsync: vi.fn<() => Promise<void>>(() => Promise.resolve()),
}));

vi.mock("drizzle-orm/expo-sqlite", () => ({
  drizzle: vi.fn<(sqliteDb: unknown) => { _: string; sqliteDb: unknown }>((sqliteDb) => ({
    _: "drizzle-instance",
    sqliteDb,
  })),
}));

vi.mock("expo-secure-store", () => ({
  getItem: vi.fn<() => string | null>(),
  setItem: vi.fn<() => void>(),
  deleteItemAsync: vi.fn<() => Promise<void>>(),
}));

vi.mock("expo-crypto", () => ({
  getRandomBytes: vi.fn<() => Uint8Array>(() => new Uint8Array(32)),
}));

vi.mock("@/shared/lib/sentry", () => ({
  captureError: vi.fn<() => void>(),
  capturePipelineEvent: vi.fn<() => void>(),
  captureWarning: vi.fn<() => void>(),
}));

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
      expect.stringMatching(/^[0-9a-f]{64}$/)
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
    const mockExecSync = vi.fn<() => void>();
    vi.mocked(openDatabaseSync).mockReturnValueOnce({
      execSync: mockExecSync,
      closeSync: vi.fn<() => void>(),
    } as unknown as ReturnType<typeof openDatabaseSync>);

    getDb("user-123");
    expect(mockExecSync).toHaveBeenCalledWith(
      expect.stringMatching(/^PRAGMA key = "x'[0-9a-f]{64}'"$/)
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
    const mockCloseSync = vi.fn<() => void>();
    vi.mocked(openDatabaseSync).mockReturnValueOnce({
      execSync: vi.fn<() => void>(),
      closeSync: mockCloseSync,
    } as unknown as ReturnType<typeof openDatabaseSync>);

    getDb("user-123");
    resetDb();
    expect(mockCloseSync).toHaveBeenCalled();

    getDb("user-456");
    expect(openDatabaseSync).toHaveBeenCalledTimes(2);
  });

  it("resetDbForUser deletes the user-scoped database", async () => {
    await resetDbForUser("user-123");

    expect(deleteDatabaseAsync).toHaveBeenCalledWith("fidy-user-123.db");
  });

  it("resetDbForUser ignores missing database errors for fresh users", async () => {
    vi.mocked(deleteDatabaseAsync).mockRejectedValueOnce(
      new Error(
        "Calling the 'deleteDatabaseAsync' function has failed\n→ Caused by: Database /tmp/fidy-user-123.db not found"
      )
    );

    await expect(resetDbForUser("user-123")).resolves.toBeUndefined();
  });

  it("auto-resets when called with a different userId", () => {
    const mockCloseSync = vi.fn<() => void>();
    vi.mocked(openDatabaseSync).mockReturnValueOnce({
      execSync: vi.fn<() => void>(),
      closeSync: mockCloseSync,
    } as unknown as ReturnType<typeof openDatabaseSync>);

    getDb("user-123");
    const db2 = getDb("user-456");

    expect(mockCloseSync).toHaveBeenCalled();
    expect(db2).toBeDefined();
    expect(openDatabaseSync).toHaveBeenCalledWith("fidy-user-456.db");
  });

  it("tryGetDb returns null instead of throwing when initialization fails", () => {
    vi.mocked(openDatabaseSync).mockImplementationOnce(() => {
      throw new Error("SQLite open failed");
    });

    expect(tryGetDb("user-123")).toBeNull();
  });
});
