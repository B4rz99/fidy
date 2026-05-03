import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailAccountRow } from "@/features/email-capture/lib/repository";
import {
  createEmailFetchClientIds,
  fetchEmailAccountBatch,
  persistFetchedAccounts,
} from "@/features/email-capture/services/email-capture-fetch-service";
import type { AnyDb } from "@/shared/db";
import { updateLastFetchedAt } from "@/features/email-capture/lib/repository";
import type { EmailAccountId, IsoDateTime, UserId } from "@/shared/types/branded";

const { mockFetchEmails, mockEnsureBankSenders } = vi.hoisted(() => ({
  mockFetchEmails: vi.fn(),
  mockEnsureBankSenders: vi.fn(),
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
