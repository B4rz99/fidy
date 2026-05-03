import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailAccountRow } from "@/features/email-capture/lib/repository";
import {
  createEmailFetchClientIds,
  fetchEmailAccountBatch,
  ingestFetchedEmails,
  persistFetchedAccounts,
} from "@/features/email-capture/services/email-capture-fetch-service";
import { createCaptureIngestionPort } from "@/features/capture-sources/ingestion.public";
import type { AnyDb } from "@/shared/db";
import { updateLastFetchedAt } from "@/features/email-capture/lib/repository";
import type { EmailAccountId, IsoDateTime, UserId } from "@/shared/types/branded";

const { mockFetchEmails, mockEnsureBankSenders, mockCapturePipelineEvent, mockCaptureWarning } =
  vi.hoisted(() => ({
    mockFetchEmails: vi.fn(),
    mockEnsureBankSenders: vi.fn(),
    mockCapturePipelineEvent: vi.fn(),
    mockCaptureWarning: vi.fn(),
  }));

vi.mock("@/features/capture-sources/ingestion.public", () => ({
  createCaptureIngestionPort: vi.fn(),
}));

vi.mock("@/features/email-capture/lib/repository", () => ({
  getFailedEmails: vi.fn(),
  getNeedsReviewEmails: vi.fn(),
  updateLastFetchedAt: vi.fn(),
}));

vi.mock("@/features/email-capture/pipeline.public", () => ({
  processBackgroundEmails: vi.fn(),
  processEmails: vi.fn(),
  processRetries: vi.fn(),
}));

vi.mock("@/features/email-capture/queries/bank-senders", () => ({
  ensureBankSenders: mockEnsureBankSenders,
}));

vi.mock("@/features/email-capture/services/email-adapter", () => ({
  getAdapter: vi.fn(() => ({
    fetchEmails: mockFetchEmails,
  })),
}));

vi.mock("@/shared/query", () => ({
  queryClient: {},
}));

vi.mock("@/shared/lib", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib")>("@/shared/lib");
  return {
    ...actual,
    captureWarning: (...args: unknown[]) => mockCaptureWarning(...args),
    capturePipelineEvent: (...args: unknown[]) => mockCapturePipelineEvent(...args),
  };
});

const makeAccount = (overrides: Partial<EmailAccountRow> = {}): EmailAccountRow => ({
  id: "ea-1" as EmailAccountId,
  userId: "user-1" as UserId,
  provider: "gmail",
  email: "alerts@example.com",
  createdAt: "2026-04-01T00:00:00.000Z" as IsoDateTime,
  lastFetchedAt: null,
  ...overrides,
});

describe("fetchEmailAccountBatch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T12:00:00.000Z"));
    vi.clearAllMocks();
    mockFetchEmails.mockResolvedValue([]);
    mockEnsureBankSenders.mockResolvedValue([{ email: "bank@example.com" }]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the account lastFetchedAt when it is newer than the lookback boundary", async () => {
    await fetchEmailAccountBatch({
      accounts: [makeAccount({ lastFetchedAt: "2026-04-15T09:00:00.000Z" as IsoDateTime })],
      clientIds: createEmailFetchClientIds("gmail-client", "outlook-client"),
    });

    expect(mockFetchEmails).toHaveBeenCalledWith("gmail-client", "2026-04-15T09:00:00.000Z", [
      "bank@example.com",
    ]);
  });

  it("clamps older lastFetchedAt values to the 30-day lookback boundary", async () => {
    await fetchEmailAccountBatch({
      accounts: [makeAccount({ lastFetchedAt: "2026-02-10T09:00:00.000Z" as IsoDateTime })],
      clientIds: createEmailFetchClientIds("gmail-client", "outlook-client"),
    });

    expect(mockFetchEmails).toHaveBeenCalledWith("gmail-client", "2026-03-21T12:00:00.000Z", [
      "bank@example.com",
    ]);
  });

  it("emits privacy-safe fetch timing telemetry", async () => {
    mockFetchEmails.mockResolvedValueOnce([
      {
        externalId: "ext-1",
        from: "bank@example.com",
        subject: "Compra aprobada en Exito por $50.000",
        body: "Compra por $50.000 enviada a user@example.com",
        receivedAt: "2026-04-20T11:59:00.000Z",
        provider: "gmail",
      },
    ]);

    await fetchEmailAccountBatch({
      accounts: [makeAccount()],
      clientIds: createEmailFetchClientIds("gmail-client", "outlook-client"),
    });

    expect(mockCapturePipelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "email",
        schema: "email_fetch_batch_v1",
        accountCount: 1,
        successfulFetchCount: 1,
        failedFetchCount: 0,
        fetchedCount: 1,
        providerFamilyCount: 1,
        providerFamilies: "gmail",
        fetchDurationMs: expect.any(Number),
        maxProviderFetchDurationMs: expect.any(Number),
      })
    );
    expect(JSON.stringify(mockCapturePipelineEvent.mock.calls)).not.toContain("Exito");
    expect(JSON.stringify(mockCapturePipelineEvent.mock.calls)).not.toContain("50.000");
    expect(JSON.stringify(mockCapturePipelineEvent.mock.calls)).not.toContain("user@example.com");
    expect(JSON.stringify(mockCapturePipelineEvent.mock.calls)).not.toContain("bank@example.com");
  });

  it("keeps failed provider fetch duration privacy-safe", async () => {
    mockFetchEmails.mockImplementationOnce(async () => {
      vi.advanceTimersByTime(125);
      throw new Error("provider timeout with Compra por $50.000");
    });

    await fetchEmailAccountBatch({
      accounts: [makeAccount()],
      clientIds: createEmailFetchClientIds("gmail-client", "outlook-client"),
    });

    expect(mockCaptureWarning).toHaveBeenCalledWith("email_adapter_fetch_failed", {
      provider: "gmail",
      errorType: "Error",
      fetchDurationMs: 125,
    });
    expect(mockCapturePipelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        schema: "email_fetch_batch_v1",
        successfulFetchCount: 0,
        failedFetchCount: 1,
        maxProviderFetchDurationMs: 125,
      })
    );
    expect(JSON.stringify(mockCaptureWarning.mock.calls)).not.toContain("50.000");
  });
});

describe("persistFetchedAccounts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T12:00:00.000Z"));
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("advances lastFetchedAt when fetched emails are durably queued for retry", async () => {
    const db = {} as AnyDb;
    const account = makeAccount();

    const result = await persistFetchedAccounts({
      db,
      fetchResults: [
        {
          account,
          rawEmails: [
            {
              externalId: "ext-1",
              from: "bank@example.com",
              subject: "Compra aprobada",
              body: "Compra por $50.000",
              receivedAt: "2026-04-20T11:59:00.000Z",
              provider: "gmail",
            },
          ],
          fetchOk: true,
          fetchDurationMs: 0,
          processingResult: {
            filtered: 0,
            skippedDuplicate: 0,
            skippedCrossSource: 0,
            saved: 0,
            failed: 1,
            pendingRetry: 1,
            needsReview: 0,
            parseImprovementRequests: [],
          },
        },
      ],
    });

    expect(updateLastFetchedAt).toHaveBeenCalledWith(db, account.id, "2026-04-20T12:00:00.000Z");
    expect(result.updatedAccountIds.has(account.id)).toBe(true);
  });

  it("does not advance lastFetchedAt when fetched email failures are not durably accounted for", async () => {
    const db = {} as AnyDb;
    const account = makeAccount();

    const result = await persistFetchedAccounts({
      db,
      fetchResults: [
        {
          account,
          rawEmails: [
            {
              externalId: "ext-1",
              from: "bank@example.com",
              subject: "Compra aprobada",
              body: "Compra por $50.000",
              receivedAt: "2026-04-20T11:59:00.000Z",
              provider: "gmail",
            },
          ],
          fetchOk: true,
          fetchDurationMs: 0,
          processingResult: {
            filtered: 0,
            skippedDuplicate: 0,
            skippedCrossSource: 0,
            saved: 0,
            failed: 1,
            pendingRetry: 0,
            needsReview: 0,
            parseImprovementRequests: [],
          },
        },
      ],
    });

    expect(updateLastFetchedAt).not.toHaveBeenCalled();
    expect(result.updatedAccountIds.has(account.id)).toBe(false);
  });
});

describe("ingestFetchedEmails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits privacy-safe retry timing telemetry", async () => {
    vi.mocked(createCaptureIngestionPort).mockReturnValue({
      ingest: vi.fn(async (command: { kind: string }) =>
        command.kind === "email_retry"
          ? { retried: 2, succeeded: 1, permanentlyFailed: 1 }
          : {
              filtered: 0,
              skippedDuplicate: 0,
              skippedCrossSource: 0,
              saved: 0,
              failed: 0,
              pendingRetry: 0,
              needsReview: 0,
              parseImprovementRequests: [],
            }
      ),
    } as never);

    await ingestFetchedEmails({
      db: {} as AnyDb,
      userId: "user-1" as UserId,
      emails: [],
      runRetries: true,
    });

    expect(mockCapturePipelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "email",
        schema: "email_retry_batch_v1",
        retried: 2,
        succeeded: 1,
        permanentlyFailed: 1,
        retryDurationMs: expect.any(Number),
      })
    );
  });

  it("does not emit retry telemetry for no-op retry checks", async () => {
    vi.mocked(createCaptureIngestionPort).mockReturnValue({
      ingest: vi.fn(async () => ({ retried: 0, succeeded: 0, permanentlyFailed: 0 })),
    } as never);

    await ingestFetchedEmails({
      db: {} as AnyDb,
      userId: "user-1" as UserId,
      emails: [],
      runRetries: true,
    });

    expect(
      mockCapturePipelineEvent.mock.calls.some(
        ([event]) =>
          typeof event === "object" &&
          event !== null &&
          "schema" in event &&
          event.schema === "email_retry_batch_v1"
      )
    ).toBe(false);
  });
});
