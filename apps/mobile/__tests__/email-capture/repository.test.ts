// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  EmailAccountId,
  IsoDateTime,
  ProcessedEmailId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

const mockValues = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockRun = vi.fn<(...args: any[]) => any>().mockReturnValue({ changes: 1 });
const mockOnConflictDoNothing = vi.fn<(...args: any[]) => any>().mockReturnValue({ run: mockRun });
const mockInsert = vi.fn<(...args: any[]) => any>(() => ({ values: mockValues }));
const mockSelect = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockFrom = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockWhere = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockOrderBy = vi.fn<(...args: any[]) => any>().mockResolvedValue([]);
const mockDelete = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockDeleteWhere = vi.fn<(...args: any[]) => any>().mockResolvedValue([]);
const mockUpdate = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockSet = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockUpdateWhere = vi.fn<(...args: any[]) => any>().mockResolvedValue([]);

const mockDb = {
  insert: mockInsert,
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  orderBy: mockOrderBy,
  delete: mockDelete,
  update: mockUpdate,
} as any;

describe("email capture repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRun.mockReturnValue({ changes: 1 });
    mockOnConflictDoNothing.mockReturnValue({ run: mockRun });
    mockValues.mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing });
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere, orderBy: mockOrderBy });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockInsert.mockReturnValue({ values: mockValues });
  });

  it("insertEmailAccount inserts with duplicate protection", async () => {
    const { insertEmailAccount } = await import("@/features/email-capture/lib/repository");

    const inserted = await insertEmailAccount(mockDb, {
      id: "ea-1" as EmailAccountId,
      userId: "user-1" as UserId,
      provider: "gmail",
      email: "test@gmail.com",
      lastFetchedAt: null,
      createdAt: "2026-03-05T10:00:00Z" as IsoDateTime,
    });

    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith({
      id: "ea-1",
      userId: "user-1",
      provider: "gmail",
      email: "test@gmail.com",
      lastFetchedAt: null,
      createdAt: "2026-03-05T10:00:00Z",
    });
    expect(mockOnConflictDoNothing).toHaveBeenCalled();
    expect(inserted).toBe(true);
  });

  it("insertEmailAccount reports duplicate conflicts", async () => {
    mockRun.mockReturnValueOnce({ changes: 0 });
    const { insertEmailAccount } = await import("@/features/email-capture/lib/repository");

    const inserted = await insertEmailAccount(mockDb, {
      id: "ea-1" as EmailAccountId,
      userId: "user-1" as UserId,
      provider: "gmail",
      email: "test@gmail.com",
      lastFetchedAt: null,
      createdAt: "2026-03-05T10:00:00Z" as IsoDateTime,
    });

    expect(inserted).toBe(false);
  });

  it("getEmailAccount returns single account by id", async () => {
    const mockRow = { id: "ea-1", userId: "user-1", provider: "gmail", email: "test@gmail.com" };
    mockWhere.mockResolvedValueOnce([mockRow]);

    const { getEmailAccount } = await import("@/features/email-capture/lib/repository");
    const result = await getEmailAccount(mockDb, "ea-1" as EmailAccountId);

    expect(result).toEqual(mockRow);
  });

  it("getEmailAccount returns null when not found", async () => {
    mockWhere.mockResolvedValueOnce([]);

    const { getEmailAccount } = await import("@/features/email-capture/lib/repository");
    const result = await getEmailAccount(mockDb, "nonexistent" as EmailAccountId);

    expect(result).toBeNull();
  });

  it("getEmailAccounts returns accounts for userId", async () => {
    const mockRows = [{ id: "ea-1", userId: "user-1", provider: "gmail", email: "test@gmail.com" }];
    mockWhere.mockResolvedValueOnce(mockRows);

    const { getEmailAccounts } = await import("@/features/email-capture/lib/repository");
    const result = await getEmailAccounts(mockDb, "user-1" as UserId);

    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
    expect(result).toEqual(mockRows);
  });

  it("deleteEmailAccount deletes by id", async () => {
    const { deleteEmailAccount } = await import("@/features/email-capture/lib/repository");

    await deleteEmailAccount(mockDb, "ea-1" as EmailAccountId);

    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it("updateLastFetchedAt updates the timestamp", async () => {
    const { updateLastFetchedAt } = await import("@/features/email-capture/lib/repository");

    await updateLastFetchedAt(
      mockDb,
      "ea-1" as EmailAccountId,
      "2026-03-05T12:00:00Z" as IsoDateTime
    );

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith({ lastFetchedAt: "2026-03-05T12:00:00Z" });
    expect(mockUpdateWhere).toHaveBeenCalled();
  });

  it("insertProcessedEmail calls db.insert", async () => {
    const { insertProcessedEmail } = await import("@/features/email-capture/lib/repository");

    await insertProcessedEmail(mockDb, {
      id: "pe-1" as ProcessedEmailId,
      externalId: "msg-123",
      provider: "gmail",
      status: "success",
      failureReason: null,
      subject: "Compra aprobada",
      rawBodyPreview: "Su compra...",
      receivedAt: "2026-03-05T10:00:00Z" as IsoDateTime,
      transactionId: "tx-1" as TransactionId,
      createdAt: "2026-03-05T10:00:00Z" as IsoDateTime,
    });

    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pe-1", externalId: "msg-123", status: "success" })
    );
  });

  it("getProcessedEmailByExternalId returns matching row", async () => {
    const mockRow = { id: "pe-1", externalId: "msg-123", status: "success" };
    mockWhere.mockResolvedValueOnce([mockRow]);

    const { getProcessedEmailByExternalId } =
      await import("@/features/email-capture/lib/repository");
    const result = await getProcessedEmailByExternalId(mockDb, "msg-123");

    expect(result).toEqual(mockRow);
  });

  it("getProcessedEmailByExternalId returns null when not found", async () => {
    mockWhere.mockResolvedValueOnce([]);

    const { getProcessedEmailByExternalId } =
      await import("@/features/email-capture/lib/repository");
    const result = await getProcessedEmailByExternalId(mockDb, "nonexistent");

    expect(result).toBeNull();
  });

  it("getFailedEmails returns emails with failed status", async () => {
    const mockRows = [{ id: "pe-1", status: "failed", subject: "Could not parse" }];
    mockWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
    mockOrderBy.mockResolvedValueOnce(mockRows);

    const { getFailedEmails } = await import("@/features/email-capture/lib/repository");
    const result = await getFailedEmails(mockDb);

    expect(mockSelect).toHaveBeenCalled();
    expect(result).toEqual(mockRows);
  });

  it("dismissProcessedEmail deletes by id", async () => {
    const { dismissProcessedEmail } = await import("@/features/email-capture/lib/repository");

    await dismissProcessedEmail(mockDb, "pe-1" as ProcessedEmailId);

    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it("getProcessedExternalIds returns empty Set for empty array", async () => {
    const { getProcessedExternalIds } = await import("@/features/email-capture/lib/repository");
    const result = await getProcessedExternalIds(mockDb, []);

    expect(result).toEqual(new Set());
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("getProcessedExternalIds queries DB and returns Set for non-empty array", async () => {
    const mockRows = [{ externalId: "msg-1" }, { externalId: "msg-2" }];
    mockWhere.mockResolvedValueOnce(mockRows);

    const { getProcessedExternalIds } = await import("@/features/email-capture/lib/repository");
    const result = await getProcessedExternalIds(mockDb, ["msg-1", "msg-2", "msg-3"]);

    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
    expect(result).toEqual(new Set(["msg-1", "msg-2"]));
  });

  it("getNeedsReviewEmails returns emails with needs_review status", async () => {
    const mockRows = [
      { id: "pe-1", status: "needs_review", subject: "Review this" },
      { id: "pe-2", status: "needs_review", subject: "And this" },
    ];
    mockWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
    mockOrderBy.mockResolvedValueOnce(mockRows);

    const { getNeedsReviewEmails } = await import("@/features/email-capture/lib/repository");
    const result = await getNeedsReviewEmails(mockDb);

    expect(mockSelect).toHaveBeenCalled();
    expect(result).toEqual(mockRows);
  });

  it("getNeedsReviewEmailByTransactionId returns the most recent linked review email", async () => {
    const mockRows = [
      {
        id: "pe-2",
        transactionId: "tx-1",
        status: "needs_review",
        receivedAt: "2026-04-19T11:00:00Z",
      },
      {
        id: "pe-1",
        transactionId: "tx-1",
        status: "needs_review",
        receivedAt: "2026-04-19T10:00:00Z",
      },
    ];
    const mockLimit = vi.fn<(...args: any[]) => any>().mockResolvedValueOnce(mockRows);
    mockWhere.mockReturnValueOnce({
      orderBy: vi.fn<(...args: any[]) => any>().mockReturnValueOnce({ limit: mockLimit }),
    });

    const { getNeedsReviewEmailByTransactionId } =
      await import("@/features/email-capture/lib/repository");
    const result = await getNeedsReviewEmailByTransactionId(mockDb, "tx-1" as TransactionId);

    expect(mockSelect).toHaveBeenCalled();
    expect(mockLimit).toHaveBeenCalledWith(1);
    expect(result).toEqual(mockRows[0]);
  });

  it("updateProcessedEmailStatus updates status and transactionId", async () => {
    const { updateProcessedEmailStatus } = await import("@/features/email-capture/lib/repository");

    await updateProcessedEmailStatus({
      db: mockDb,
      id: "pe-1" as ProcessedEmailId,
      status: "success",
      transactionId: "tx-1" as TransactionId,
    });

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith({ status: "success", transactionId: "tx-1" });
    expect(mockUpdateWhere).toHaveBeenCalled();
  });

  it("getPendingRetryEmails returns pending_retry emails where nextRetryAt <= now", async () => {
    const mockRows = [{ id: "pe-1", status: "pending_retry", rawBody: "body", retryCount: 1 }];
    const mockLimit = vi.fn<(...args: any[]) => any>().mockResolvedValueOnce(mockRows);
    mockWhere.mockReturnValueOnce({
      orderBy: vi.fn<(...args: any[]) => any>().mockReturnValueOnce({ limit: mockLimit }),
    });

    const { getPendingRetryEmails } = await import("@/features/email-capture/lib/repository");
    const result = await getPendingRetryEmails(mockDb);

    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
    expect(mockLimit).toHaveBeenCalledWith(50);
    expect(result).toEqual(mockRows);
  });

  it("markForRetry updates status, retryCount, nextRetryAt, rawBody", async () => {
    const { markForRetry } = await import("@/features/email-capture/lib/repository");

    await markForRetry({
      db: mockDb,
      id: "pe-1" as ProcessedEmailId,
      retryCount: 2,
      nextRetryAt: "2026-03-15T13:00:00Z" as IsoDateTime,
    });

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith({
      status: "pending_retry",
      retryCount: 2,
      nextRetryAt: "2026-03-15T13:00:00Z",
    });
    expect(mockUpdateWhere).toHaveBeenCalled();
  });

  it("markPermanentlyFailed sets status=failed and clears rawBody", async () => {
    const { markPermanentlyFailed } = await import("@/features/email-capture/lib/repository");

    await markPermanentlyFailed(mockDb, "pe-1" as ProcessedEmailId);

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith({
      status: "failed",
      rawBody: null,
    });
    expect(mockUpdateWhere).toHaveBeenCalled();
  });

  it("markRetrySuccess sets status, transactionId, confidence, clears rawBody", async () => {
    const { markRetrySuccess } = await import("@/features/email-capture/lib/repository");

    await markRetrySuccess({
      db: mockDb,
      id: "pe-1" as ProcessedEmailId,
      status: "success",
      transactionId: "tx-5" as TransactionId,
      confidence: 0.95,
    });

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith({
      status: "success",
      transactionId: "tx-5",
      confidence: 0.95,
      rawBody: null,
    });
    expect(mockUpdateWhere).toHaveBeenCalled();
  });
});
