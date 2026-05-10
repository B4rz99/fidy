// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserId } from "@/shared/types/branded";

const mockAll = vi.fn<(...args: any[]) => any>().mockReturnValue([]);
const mockSelect = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockFrom = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockWhere = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockOrderBy = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockLimit = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockOffset = vi.fn<(...args: any[]) => any>().mockReturnThis();

const mockDb = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  orderBy: mockOrderBy,
} as any;

describe("getTransfersPaginated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy });
    mockOrderBy.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ offset: mockOffset });
    mockOffset.mockReturnValue({ all: mockAll });
  });

  it("calls limit with limit+1 for hasMore detection", async () => {
    const { getTransfersPaginated } = await import("@/features/transfers/lib/repository");
    getTransfersPaginated({ db: mockDb, userId: "user-1" as UserId, limit: 30, offset: 0 });

    expect(mockLimit).toHaveBeenCalledWith(31);
  });

  it("uses a unique tiebreaker in the sort order", async () => {
    const { getTransfersPaginated } = await import("@/features/transfers/lib/repository");
    getTransfersPaginated({ db: mockDb, userId: "user-1" as UserId, limit: 30, offset: 0 });

    expect(mockOrderBy).toHaveBeenCalledOnce();
    expect(mockOrderBy.mock.calls[0]).toHaveLength(3);
  });
});
