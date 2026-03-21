// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  EmailAccountId,
  IsoDateTime,
  ProcessedEmailId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

const mockValues = vi.fn().mockReturnThis();
const mockInsert = vi.fn(() => ({ values: mockValues }));
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockReturnThis();
const mockOrderBy = vi.fn().mockResolvedValue([]);
const mockDelete = vi.fn().mockReturnThis();
const mockDeleteWhere = vi.fn().mockResolvedValue([]);
const mockUpdate = vi.fn().mockReturnThis();
const mockSet = vi.fn().mockReturnThis();
const mockUpdateWhere = vi.fn().mockResolvedValue([]);

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
    mockValues.mockReturnThis();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere, orderBy: mockOrderBy });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockUpdateWhere });
    mockInsert.mockReturnValue({ values: mockValues });
  });

  it("insertEmailAccount calls db.insert with correct row", async () => {
    const { insertEmailAccount } = await import("@/features/email-capture/lib/repository");

    await insertEmailAccount(mockDb, {
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

    await updateLastFetchedAt(mockDb, "ea-1" as EmailAccountId, "2026-03-05T12:00:00Z" as IsoDateTime);

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

    const { getProcessedEmailByExternalId } = await import(
      "@/features/email-capture/lib/repository"
    );
    const result = await getProcessedEmailByExternalId(mockDb, "msg-123");

    expect(result).toEqual(mockRow);
  });

  it("getProcessedEmailByExternalId returns null when not found", async () => {
    mockWhere.mockResolvedValueOnce([]);

    const { getProcessedEmailByExternalId } = await import(
      "@/features/email-capture/lib/repository"
    );
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

  it("updateProcessedEmailStatus updates status and transactionId", async () => {
    const { updateProcessedEmailStatus } = await import("@/features/email-capture/lib/repository");

    await updateProcessedEmailStatus(mockDb, "pe-1" as ProcessedEmailId, "success", "tx-1" as TransactionId);

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith({ status: "success", transactionId: "tx-1" });
    expect(mockUpdateWhere).toHaveBeenCalled();
  });

  it("getPendingRetryEmails returns pending_retry emails where nextRetryAt <= now", async () => {
    const mockRows = [{ id: "pe-1", status: "pending_retry", rawBody: "body", retryCount: 1 }];
    const mockLimit = vi.fn().mockResolvedValueOnce(mockRows);
    mockWhere.mockReturnValueOnce({ orderBy: vi.fn().mockReturnValueOnce({ limit: mockLimit }) });

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

    await markForRetry(mockDb, "pe-1" as ProcessedEmailId, 2, "2026-03-15T13:00:00Z" as IsoDateTime);

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

    await markRetrySuccess(mockDb, "pe-1" as ProcessedEmailId, "success", "tx-5" as TransactionId, 0.95);

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
