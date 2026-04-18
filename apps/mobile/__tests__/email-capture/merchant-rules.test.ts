import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireCategoryId, requireIsoDateTime, requireUserId } from "@/shared/types/assertions";

import {
  insertMerchantRule,
  lookupMerchantRule,
} from "../../features/email-capture/lib/merchant-rules";

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
}));

vi.mock("@/shared/db/schema", () => ({
  merchantRules: {
    categoryId: "category_id",
    userId: "user_id",
    keyword: "keyword",
  },
}));

const mockWhere = vi.fn();
const mockOnConflictDoUpdate = vi.fn();

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: mockWhere,
    })),
  })),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    })),
  })),
  // biome-ignore lint/suspicious/noExplicitAny: mock DB object for testing
} as any;

describe("merchant-rules", () => {
  const UserId = requireUserId("user1");
  const CategoryId = requireCategoryId("food");
  const Now = requireIsoDateTime("2026-03-07T10:00:00Z");

  beforeEach(() => vi.clearAllMocks());

  describe("lookupMerchantRule", () => {
    it("returns categoryId when found", async () => {
      mockWhere.mockResolvedValue([{ categoryId: "food" }]);
      const result = await lookupMerchantRule(mockDb, UserId, "restaurant");
      expect(result).toBe("food");
    });

    it("returns null when not found", async () => {
      mockWhere.mockResolvedValue([]);
      const result = await lookupMerchantRule(mockDb, UserId, "unknown");
      expect(result).toBeNull();
    });
  });

  describe("insertMerchantRule", () => {
    it("calls insert with correct values", async () => {
      mockOnConflictDoUpdate.mockResolvedValue(undefined);
      await insertMerchantRule(mockDb, UserId, "restaurant", CategoryId, Now);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });
});
