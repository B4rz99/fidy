// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  EmailAccountId,
  IsoDateTime,
  ProcessedEmailId,
  ProcessedSourceEventId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

const mockValues = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockRun = vi.fn<(...args: any[]) => any>().mockReturnValue({ changes: 1 });
const mockOnConflictDoNothing = vi.fn<(...args: any[]) => any>().mockReturnValue({ run: mockRun });
const mockInsert = vi.fn<(...args: any[]) => any>(() => ({ values: mockValues }));
const mockSelect = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockFrom = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockInnerJoin = vi.fn<(...args: any[]) => any>().mockReturnThis();
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
    mockFrom.mockReturnValue({ where: mockWhere, orderBy: mockOrderBy, innerJoin: mockInnerJoin });
    mockInnerJoin.mockReturnValue({ where: mockWhere });
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

  it("getFailedEmails returns failed email source events", async () => {
    const mockRows = [
      {
        id: "pse-1" as ProcessedSourceEventId,
        sourceFamily: "email",
        sourceId: "email_gmail",
        sourceEventId: "gmail-message-1",
        status: "failed",
        failureReason: "parse_error",
        receivedAt: "2026-04-19T11:00:00Z" as IsoDateTime,
        processedAt: "2026-04-19T11:01:00Z" as IsoDateTime,
        createdAt: "2026-04-19T11:01:00Z" as IsoDateTime,
      },
    ];
    mockWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
    mockOrderBy.mockResolvedValueOnce(mockRows);

    const { getFailedEmails } = await import("@/features/email-capture/lib/repository");
    const result = await getFailedEmails(mockDb, "user-1" as UserId);

    expect(mockSelect).toHaveBeenCalled();
    expect(result).toEqual([
      expect.objectContaining({
        id: "pse-1",
        externalId: "gmail-message-1",
        provider: "gmail",
        status: "failed",
        failureReason: "parse_error",
      }),
    ]);
  });

  it("dismissProcessedEmail dismisses the source event by id", async () => {
    const { dismissProcessedEmail } = await import("@/features/email-capture/lib/repository");

    await dismissProcessedEmail(mockDb, "pe-1" as ProcessedEmailId);

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith({ status: "dismissed" });
    expect(mockDelete).not.toHaveBeenCalled();
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

  it("getNeedsReviewEmails returns pending email review candidates", async () => {
    const mockRows = [
      {
        candidateId: "rc-1",
        sourceEventId: "pse-1",
        sourceId: "email_gmail",
        externalId: "gmail-message-1",
        status: "needs_review",
        failureReason: null,
        receivedAt: "2026-04-19T11:00:00Z" as IsoDateTime,
        createdAt: "2026-04-19T11:01:00Z" as IsoDateTime,
        confidence: 0.5,
      },
    ];
    mockWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
    mockOrderBy.mockResolvedValueOnce(mockRows);

    const { getNeedsReviewEmails } = await import("@/features/email-capture/lib/repository");
    const result = await getNeedsReviewEmails(mockDb, "user-1" as UserId);

    expect(mockSelect).toHaveBeenCalled();
    expect(mockInnerJoin).toHaveBeenCalled();
    expect(result).toEqual([
      expect.objectContaining({
        id: "rc-1",
        reviewCandidateId: "rc-1",
        processedSourceEventId: "pse-1",
        externalId: "gmail-message-1",
        provider: "gmail",
        status: "needs_review",
        confidence: 0.5,
      }),
    ]);
  });

  it("getNeedsReviewEmailByTransactionId returns legacy processed email review rows", async () => {
    const mockRows = [
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
    const mockRows = [
      {
        id: "pse-1",
        sourceEventId: "gmail-message-1",
        sourceId: "email_gmail",
        status: "pending_retry",
        failureReason: "parse_error",
        retryRawBody: "body",
        retryCount: 1,
        nextRetryAt: "2026-03-15T13:00:00Z",
        retryTransactionId: null,
        retryConfidence: null,
        receivedAt: "2026-03-15T12:00:00Z",
        createdAt: "2026-03-15T12:00:00Z",
      },
    ];
    const mockLimit = vi.fn<(...args: any[]) => any>().mockResolvedValueOnce(mockRows);
    mockWhere.mockReturnValueOnce({
      orderBy: vi.fn<(...args: any[]) => any>().mockReturnValueOnce({ limit: mockLimit }),
    });

    const { getPendingRetryEmails } = await import("@/features/email-capture/lib/repository");
    const result = await getPendingRetryEmails(mockDb, "user-1" as UserId);

    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
    expect(mockLimit).toHaveBeenCalledWith(50);
    expect(result).toEqual([
      expect.objectContaining({
        id: "pse-1",
        externalId: "gmail-message-1",
        provider: "gmail",
        status: "pending_retry",
        rawBody: "body",
        retryCount: 1,
      }),
    ]);
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
      retryRawBody: null,
      nextRetryAt: null,
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
      retryTransactionId: "tx-5",
      retryConfidence: 0.95,
      retryRawBody: null,
      nextRetryAt: null,
    });
    expect(mockUpdateWhere).toHaveBeenCalled();
  });

  it("markRetryTerminalStatus updates only source-event retry state", async () => {
    const { markRetryTerminalStatus } = await import("@/features/email-capture/lib/repository");

    await markRetryTerminalStatus({
      db: mockDb,
      id: "pse-1" as ProcessedEmailId,
      status: "skipped",
      transactionId: null,
    });

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith({
      status: "skipped",
      retryTransactionId: null,
      retryRawBody: null,
      nextRetryAt: null,
    });
    expect(mockUpdateWhere).toHaveBeenCalled();
  });
});
