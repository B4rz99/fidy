// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";

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
      id: "ea-1",
      userId: "user-1",
      provider: "gmail",
      email: "test@gmail.com",
      lastFetchedAt: null,
      createdAt: "2026-03-05T10:00:00Z",
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
    const result = await getEmailAccount(mockDb, "ea-1");

    expect(result).toEqual(mockRow);
  });

  it("getEmailAccount returns null when not found", async () => {
    mockWhere.mockResolvedValueOnce([]);

    const { getEmailAccount } = await import("@/features/email-capture/lib/repository");
    const result = await getEmailAccount(mockDb, "nonexistent");

    expect(result).toBeNull();
  });

  it("getEmailAccounts returns accounts for userId", async () => {
    const mockRows = [{ id: "ea-1", userId: "user-1", provider: "gmail", email: "test@gmail.com" }];
    mockWhere.mockResolvedValueOnce(mockRows);

    const { getEmailAccounts } = await import("@/features/email-capture/lib/repository");
    const result = await getEmailAccounts(mockDb, "user-1");

    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
    expect(result).toEqual(mockRows);
  });

  it("deleteEmailAccount deletes by id", async () => {
    const { deleteEmailAccount } = await import("@/features/email-capture/lib/repository");

    await deleteEmailAccount(mockDb, "ea-1");

    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteWhere).toHaveBeenCalled();
  });

  it("updateLastFetchedAt updates the timestamp", async () => {
    const { updateLastFetchedAt } = await import("@/features/email-capture/lib/repository");

    await updateLastFetchedAt(mockDb, "ea-1", "2026-03-05T12:00:00Z");

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith({ lastFetchedAt: "2026-03-05T12:00:00Z" });
    expect(mockUpdateWhere).toHaveBeenCalled();
  });

  it("insertProcessedEmail calls db.insert", async () => {
    const { insertProcessedEmail } = await import("@/features/email-capture/lib/repository");

    await insertProcessedEmail(mockDb, {
      id: "pe-1",
      externalId: "msg-123",
      provider: "gmail",
      status: "success",
      failureReason: null,
      subject: "Compra aprobada",
      rawBodyPreview: "Su compra...",
      receivedAt: "2026-03-05T10:00:00Z",
      transactionId: "tx-1",
      createdAt: "2026-03-05T10:00:00Z",
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

    await dismissProcessedEmail(mockDb, "pe-1");

    expect(mockDelete).toHaveBeenCalled();
    expect(mockDeleteWhere).toHaveBeenCalled();
  });
});
