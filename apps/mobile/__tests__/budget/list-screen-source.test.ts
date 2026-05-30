import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../../features/budget/components/BudgetListScreen.tsx"),
  "utf-8"
);

describe("BudgetListScreen notification prompt routing", () => {
  it("renders pending budget alerts above the monthly summary", () => {
    expect(source).toContain("BudgetAlertBanner");
    expect(source).toContain("pendingAlerts.map");
    expect(source).toContain("onDismiss={acknowledgeAlert}");
    expect(source).toContain("<BudgetSummaryCard");
    expect(source.indexOf("pendingAlerts.map")).toBeLessThan(source.indexOf("<BudgetSummaryCard"));
  });

  it("guards stale pending permission signals before opening the notification sheet", () => {
    expect(source).toContain("clearPendingPermissionRequest");
    expect(source).toContain("shouldShowNotificationPrePermissionPrompt()");
    expect(source).toContain("if (cancelled || !shouldShowPrompt) return");
    expect(source).toContain('push("/enable-notifications")');
    expect(source).toContain(".catch(captureError)");
    expect(source).toContain(".finally(() =>");
    expect(source).toContain("if (!cancelled) clearPendingPermissionRequest()");
    expect(source).not.toMatch(/\{\s+clearPendingPermissionRequest\(\);\s+let cancelled = false;/);
  });
});
