// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApplePayIntentData, NotificationData } from "@/features/capture-sources/schema";
import { createCaptureIngestionPort } from "@/features/capture-sources/services/capture-ingestion";
import type { RawEmail } from "@/features/email-capture/schema";
import type { UserId } from "@/shared/types/branded";

const mockProcessNotification = vi.fn();
const mockProcessApplePayIntent = vi.fn();
const mockProcessWidgetTransactions = vi.fn();
const mockProcessEmails = vi.fn();
const mockProcessRetries = vi.fn();

const mockDb = {} as any;
const USER_ID = "user-1" as UserId;

describe("capture ingestion port", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProcessNotification.mockResolvedValue({ saved: true, skippedDuplicate: false });
    mockProcessApplePayIntent.mockResolvedValue({ saved: true, skippedDuplicate: false });
    mockProcessWidgetTransactions.mockResolvedValue({ saved: 1, skippedDuplicate: 0, errors: 0 });
    mockProcessEmails.mockResolvedValue({
      filtered: 0,
      skippedDuplicate: 0,
      skippedCrossSource: 0,
      saved: 0,
      failed: 0,
      needsReview: 0,
    });
    mockProcessRetries.mockResolvedValue({
      retried: 0,
      succeeded: 0,
      permanentlyFailed: 0,
    });
  });

  it("routes notification commands to the notification pipeline", async () => {
    const port = createCaptureIngestionPort(mockDb, {
      processNotification: (...args: any[]) => mockProcessNotification(...args),
      processApplePayIntent: (...args: any[]) => mockProcessApplePayIntent(...args),
      processWidgetTransactions: (...args: any[]) => mockProcessWidgetTransactions(...args),
      processEmails: (...args: any[]) => mockProcessEmails(...args),
      processRetries: (...args: any[]) => mockProcessRetries(...args),
    });
    const notification: NotificationData = {
      packageName: "com.todo1.mobile.co.bancolombia",
      text: "Bancolombia le informa compra por $50,000",
      timestamp: Date.now(),
    };

    await port.ingest({ kind: "notification", userId: USER_ID, notification });

    expect(mockProcessNotification).toHaveBeenCalledWith(mockDb, USER_ID, notification);
  });

  it("routes Apple Pay commands to the Apple Pay pipeline", async () => {
    const port = createCaptureIngestionPort(mockDb, {
      processNotification: (...args: any[]) => mockProcessNotification(...args),
      processApplePayIntent: (...args: any[]) => mockProcessApplePayIntent(...args),
      processWidgetTransactions: (...args: any[]) => mockProcessWidgetTransactions(...args),
      processEmails: (...args: any[]) => mockProcessEmails(...args),
      processRetries: (...args: any[]) => mockProcessRetries(...args),
    });
    const intent: ApplePayIntentData = {
      amount: 50000,
      merchant: "Farmatodo",
    };

    await port.ingest({ kind: "apple_pay", userId: USER_ID, intent });

    expect(mockProcessApplePayIntent).toHaveBeenCalledWith(mockDb, USER_ID, intent);
  });

  it("routes widget commands to the widget pipeline", async () => {
    const port = createCaptureIngestionPort(mockDb, {
      processNotification: (...args: any[]) => mockProcessNotification(...args),
      processApplePayIntent: (...args: any[]) => mockProcessApplePayIntent(...args),
      processWidgetTransactions: (...args: any[]) => mockProcessWidgetTransactions(...args),
      processEmails: (...args: any[]) => mockProcessEmails(...args),
      processRetries: (...args: any[]) => mockProcessRetries(...args),
    });

    await port.ingest({ kind: "widget", userId: USER_ID });

    expect(mockProcessWidgetTransactions).toHaveBeenCalledWith(mockDb, USER_ID);
  });

  it("supports command-specific partial overrides without requiring every handler", async () => {
    const port = createCaptureIngestionPort(mockDb, {
      processWidgetTransactions: (...args: any[]) => mockProcessWidgetTransactions(...args),
    });

    await port.ingest({ kind: "widget", userId: USER_ID });

    expect(mockProcessWidgetTransactions).toHaveBeenCalledWith(mockDb, USER_ID);
  });

  it("routes email batch commands with progress callbacks intact", async () => {
    const port = createCaptureIngestionPort(mockDb, {
      processNotification: (...args: any[]) => mockProcessNotification(...args),
      processApplePayIntent: (...args: any[]) => mockProcessApplePayIntent(...args),
      processWidgetTransactions: (...args: any[]) => mockProcessWidgetTransactions(...args),
      processEmails: (...args: any[]) => mockProcessEmails(...args),
      processRetries: (...args: any[]) => mockProcessRetries(...args),
    });
    const emails: RawEmail[] = [
      {
        externalId: "ext-1",
        from: "notificaciones@bancolombia.com.co",
        subject: "Compra aprobada",
        body: "body",
        receivedAt: "2026-03-05T10:00:00Z",
        provider: "gmail",
      },
    ];
    const onProgress = vi.fn();

    mockProcessEmails.mockImplementationOnce(async (_db, _userId, passedEmails, progress) => {
      progress?.({ total: passedEmails.length, completed: 1, saved: 1, failed: 0, needsReview: 0 });
      return {
        filtered: 0,
        skippedDuplicate: 0,
        skippedCrossSource: 0,
        saved: 1,
        failed: 0,
        needsReview: 0,
      };
    });

    await port.ingest({ kind: "email_batch", userId: USER_ID, emails, onProgress });

    expect(mockProcessEmails).toHaveBeenCalledWith(mockDb, USER_ID, emails, onProgress);
    expect(onProgress).toHaveBeenCalledWith({
      total: 1,
      completed: 1,
      saved: 1,
      failed: 0,
      needsReview: 0,
    });
  });

  it("routes email retry commands to the retry pipeline", async () => {
    const port = createCaptureIngestionPort(mockDb, {
      processNotification: (...args: any[]) => mockProcessNotification(...args),
      processApplePayIntent: (...args: any[]) => mockProcessApplePayIntent(...args),
      processWidgetTransactions: (...args: any[]) => mockProcessWidgetTransactions(...args),
      processEmails: (...args: any[]) => mockProcessEmails(...args),
      processRetries: (...args: any[]) => mockProcessRetries(...args),
    });

    await port.ingest({ kind: "email_retry", userId: USER_ID });

    expect(mockProcessRetries).toHaveBeenCalledWith(mockDb, USER_ID);
  });
});
