import { afterEach, describe, expect, it, vi } from "vitest";
import { requestNotificationPermissionStatus } from "@/features/notifications/services/request-permission";
import type { PermissionStatus } from "expo-notifications";

const granted = "granted" as PermissionStatus;

describe("requestNotificationPermissionStatus", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the granted status before the timeout", async () => {
    vi.useFakeTimers();
    const captureWarning = vi.fn();

    const result = requestNotificationPermissionStatus({
      captureWarning,
      requestPermissions: () => Promise.resolve({ status: granted }),
      timeoutMs: 8000,
    });

    await expect(result).resolves.toBe(granted);
    await vi.advanceTimersByTimeAsync(8000);

    expect(captureWarning).not.toHaveBeenCalled();
  });

  it("resolves null when the native permission request stalls", async () => {
    vi.useFakeTimers();
    const captureWarning = vi.fn();

    const result = requestNotificationPermissionStatus({
      captureWarning,
      requestPermissions: () => new Promise(() => {}),
      timeoutMs: 8000,
    });

    await vi.advanceTimersByTimeAsync(8000);

    await expect(result).resolves.toBeNull();
    expect(captureWarning).toHaveBeenCalledWith("notification_permission_request_failed", {
      reason: "timeout",
      timeoutMs: 8000,
    });
  });

  it("resolves null when the native permission request rejects", async () => {
    vi.useFakeTimers();
    const captureWarning = vi.fn();

    const result = requestNotificationPermissionStatus({
      captureWarning,
      requestPermissions: () =>
        Promise.reject(new Error("fetch failed: Fetch request has been canceled")),
      timeoutMs: 8000,
    });

    await expect(result).resolves.toBeNull();
    expect(captureWarning).toHaveBeenCalledWith("notification_permission_request_failed", {
      reason: "rejected",
      timeoutMs: 8000,
    });
  });

  it("does not report a late rejection after timeout already resolved", async () => {
    vi.useFakeTimers();
    const captureWarning = vi.fn();

    const result = requestNotificationPermissionStatus({
      captureWarning,
      requestPermissions: () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("late native rejection")), 9000);
        }),
      timeoutMs: 8000,
    });

    await vi.advanceTimersByTimeAsync(8000);
    await expect(result).resolves.toBeNull();
    await vi.advanceTimersByTimeAsync(1000);

    expect(captureWarning).toHaveBeenCalledTimes(1);
  });
});
