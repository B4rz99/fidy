import { describe, expect, it, vi } from "vitest";
import type { NotificationData } from "@/features/capture-sources/schema";
import {
  buildFailedFingerprint,
  normalizeNotificationCommand,
  resolveCategoryId,
  selectAccountResolution,
} from "@/features/capture-sources/services/notification-pipeline/context";

vi.mock("@/features/email-capture/parsing.public", () => ({
  stripPii: vi.fn<(...args: any[]) => any>((text: string) => `sanitized:${text}`),
}));

vi.mock("@/features/transactions/write.public", () => ({
  isValidCategoryId: (value: string) => ["food", "other"].includes(value),
}));

const EVIDENCE = [
  {
    sourceFamily: "bancolombia",
    evidenceType: "last4",
    scope: "notification:bancolombia:last4",
    value: "1234",
  },
] as const;

function makeNotification(overrides: Partial<NotificationData> = {}): NotificationData {
  return {
    packageName: "com.todo1.mobile.co.bancolombia",
    text: "Compra por $50,000",
    timestamp: Date.UTC(2026, 3, 18, 10, 0, 0),
    ...overrides,
  };
}

describe("notification pipeline context helper", () => {
  it("normalizes notification command fields and capture evidence", () => {
    const context = normalizeNotificationCommand(
      {
        db: {} as never,
        userId: "user-1" as never,
        notification: makeNotification({ bigText: "Expanded purchase detail" }),
      },
      () => EVIDENCE
    );

    expect(context.notificationText).toBe("Expanded purchase detail");
    expect(context.sanitizedText).toBe("sanitized:Expanded purchase detail");
    expect(context.captureEvidence).toEqual(EVIDENCE);
    expect(context.source).toBe("notification_android");
    expect(context.notificationDate).toBe("2026-04-18");
  });

  it("falls back invalid categories to other", () => {
    expect(resolveCategoryId("food")).toBe("food");
    expect(resolveCategoryId("unknown-category")).toBe("other");
  });

  it("selects inferred vs unresolved account attribution", () => {
    expect(selectAccountResolution("fa-card-1" as never, "fa-default-1" as never)).toEqual({
      accountId: "fa-card-1",
      accountAttributionState: "inferred",
    });
    expect(selectAccountResolution(null, "fa-default-1" as never)).toEqual({
      accountId: "fa-default-1",
      accountAttributionState: "unresolved",
    });
  });

  it("builds failed fingerprints from package and timestamp", () => {
    expect(buildFailedFingerprint(makeNotification({ timestamp: 123 }))).toBe(
      "failed:com.todo1.mobile.co.bancolombia:123"
    );
  });
});
