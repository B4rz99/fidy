// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EmailAccountId, IsoDateTime, UserId } from "@/shared/types/branded";

const mockValues = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockRun = vi.fn<(...args: any[]) => any>().mockReturnValue({ changes: 1 });
const mockOnConflictDoNothing = vi.fn<(...args: any[]) => any>().mockReturnValue({ run: mockRun });
const mockInsert = vi.fn<(...args: any[]) => any>(() => ({ values: mockValues }));
const mockSelect = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockSelectDistinct = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockLimit = vi.fn<(...args: any[]) => any>().mockResolvedValue([]);
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
  selectDistinct: mockSelectDistinct,
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
    mockLimit.mockResolvedValue([]);
    mockOnConflictDoNothing.mockReturnValue({ run: mockRun });
    mockValues.mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing });
    mockSelect.mockReturnValue({ from: mockFrom });
    mockSelectDistinct.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({
      innerJoin: mockInnerJoin,
      where: mockWhere,
      orderBy: mockOrderBy,
      limit: mockLimit,
    });
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
});
