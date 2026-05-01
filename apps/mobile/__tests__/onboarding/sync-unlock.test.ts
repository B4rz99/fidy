import { describe, expect, it } from "vitest";
import {
  SYNC_EARLY_UNLOCK_FOUND_COUNT,
  SYNC_EARLY_UNLOCK_TIMEOUT_MS,
  shouldUnlockEmailSyncStep,
} from "@/features/onboarding/lib/sync-unlock";

describe("email sync onboarding unlock policy", () => {
  it("unlocks once enough transactions are found before the full import completes", () => {
    expect(
      shouldUnlockEmailSyncStep({
        foundCount: SYNC_EARLY_UNLOCK_FOUND_COUNT,
        elapsedMs: 5000,
        isComplete: false,
      })
    ).toBe(true);
  });

  it("unlocks after the timeout even when no transactions were found yet", () => {
    expect(
      shouldUnlockEmailSyncStep({
        foundCount: 0,
        elapsedMs: SYNC_EARLY_UNLOCK_TIMEOUT_MS,
        isComplete: false,
      })
    ).toBe(true);
  });

  it("stays locked before the threshold and timeout unless the import is complete", () => {
    expect(
      shouldUnlockEmailSyncStep({
        foundCount: SYNC_EARLY_UNLOCK_FOUND_COUNT - 1,
        elapsedMs: SYNC_EARLY_UNLOCK_TIMEOUT_MS - 1,
        isComplete: false,
      })
    ).toBe(false);
  });
});
