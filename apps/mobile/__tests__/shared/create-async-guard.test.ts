import { describe, expect, test } from "vitest";
import { createAsyncGuard } from "@/shared/hooks/create-async-guard";

describe("createAsyncGuard", () => {
  test("tryAcquire succeeds when idle", () => {
    const guard = createAsyncGuard();
    expect(guard.tryAcquire()).toBe(true);
  });

  test("tryAcquire fails while already acquired", () => {
    const guard = createAsyncGuard();
    guard.tryAcquire();
    expect(guard.tryAcquire()).toBe(false);
  });

  test("tryAcquire succeeds again after release", () => {
    const guard = createAsyncGuard();
    guard.tryAcquire();
    guard.release();
    expect(guard.tryAcquire()).toBe(true);
  });

  test("isBusy reflects current state", () => {
    const guard = createAsyncGuard();
    expect(guard.isBusy()).toBe(false);
    guard.tryAcquire();
    expect(guard.isBusy()).toBe(true);
    guard.release();
    expect(guard.isBusy()).toBe(false);
  });

  test("concurrent save simulation — only first caller proceeds", async () => {
    const guard = createAsyncGuard();

    const simulateSave = async (id: number): Promise<number | undefined> => {
      if (!guard.tryAcquire()) return undefined;
      try {
        await new Promise((r) => setTimeout(r, 10));
        return id;
      } finally {
        guard.release();
      }
    };

    const results = await Promise.all([simulateSave(1), simulateSave(2), simulateSave(3)]);
    const executed = results.filter((r) => r !== undefined);

    expect(executed).toEqual([1]);
  });

  test("guard resets after async work throws", async () => {
    const guard = createAsyncGuard();

    const failingWork = async () => {
      if (!guard.tryAcquire()) return "blocked";
      try {
        throw new Error("save failed");
      } finally {
        guard.release();
      }
    };

    await failingWork().catch(() => {});
    expect(guard.isBusy()).toBe(false);
    expect(guard.tryAcquire()).toBe(true);
  });
});
