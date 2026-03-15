import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCaptureError = vi.fn();

vi.mock("@/shared/lib/sentry", () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
}));

vi.mock("expo-sqlite", () => ({
  openDatabaseSync: vi.fn(() => ({ execSync: vi.fn(), closeSync: vi.fn() })),
}));

vi.mock("drizzle-orm/expo-sqlite", () => ({
  drizzle: vi.fn((sqliteDb: unknown) => ({ _: "drizzle-instance", sqliteDb })),
}));

import { openDatabaseSync } from "expo-sqlite";
import { getDb, resetDb } from "@/shared/db/client";

describe("getDb error path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDb();
  });

  it("calls captureError and re-throws when openDatabaseSync fails", () => {
    const dbError = new Error("SQLite open failed");
    vi.mocked(openDatabaseSync).mockImplementationOnce(() => {
      throw dbError;
    });

    expect(() => getDb("user-123")).toThrow("SQLite open failed");
    expect(mockCaptureError).toHaveBeenCalledWith(dbError);
  });

  it("calls captureError and re-throws when PRAGMA key fails", () => {
    const pragmaError = new Error("PRAGMA key failed");
    vi.mocked(openDatabaseSync).mockReturnValueOnce({
      execSync: vi.fn(() => {
        throw pragmaError;
      }),
      closeSync: vi.fn(),
    } as unknown as ReturnType<typeof openDatabaseSync>);

    expect(() => getDb("user-123")).toThrow("PRAGMA key failed");
    expect(mockCaptureError).toHaveBeenCalledWith(pragmaError);
  });
});
