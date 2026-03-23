import { describe, expect, it } from "vitest";
import { determineAlertAction } from "@/features/notifications/lib/permission";

describe("determineAlertAction", () => {
  it("returns 'send' when permission granted and notifications enabled", () => {
    const result = determineAlertAction("granted", false, true);
    expect(result).toEqual({ type: "send" });
  });

  it("returns 'pre_permission' when status undetermined, not seen before, and enabled", () => {
    const result = determineAlertAction("undetermined", false, true);
    expect(result).toEqual({ type: "pre_permission" });
  });

  it("returns 'skip' when status undetermined but already seen pre-permission", () => {
    const result = determineAlertAction("undetermined", true, true);
    expect(result).toEqual({ type: "skip" });
  });

  it("returns 'skip' when status denied", () => {
    const result = determineAlertAction("denied", false, true);
    expect(result).toEqual({ type: "skip" });
  });

  it("returns 'skip' when notificationsEnabled is false regardless of OS status", () => {
    expect(determineAlertAction("granted", false, false)).toEqual({ type: "skip" });
    expect(determineAlertAction("undetermined", false, false)).toEqual({ type: "skip" });
    expect(determineAlertAction("denied", false, false)).toEqual({ type: "skip" });
  });

  it("returns 'send' when permission granted even if hasSeenPrePermission is true", () => {
    const result = determineAlertAction("granted", true, true);
    expect(result).toEqual({ type: "send" });
  });
});
