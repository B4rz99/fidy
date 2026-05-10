import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireCategoryId, requireIsoDateTime, requireUserId } from "@/shared/types/assertions";

import {
  insertMerchantRule,
  lookupMerchantRule,
} from "../../features/email-capture/lib/merchant-rules";

vi.mock("drizzle-orm", () => ({
  and: vi.fn<(...args: any[]) => any>((...args: unknown[]) => args),
  eq: vi.fn<(...args: any[]) => any>((col: unknown, val: unknown) => ({ col, val })),
}));

vi.mock("@/shared/db/schema", () => ({
  merchantRules: {
    id: "id",
    categoryId: "category_id",
    userId: "user_id",
    keyword: "keyword",
    createdAt: "created_at",
  },
}));

vi.mock("@/shared/lib", () => ({
  generateMerchantRuleId: () => "merchant-rule-1",
}));

const mockWhere = vi.fn<(...args: any[]) => any>();
const mockValues = vi.fn<(...args: any[]) => any>(() => ({
  onConflictDoUpdate: mockOnConflictDoUpdate,
}));
const mockOnConflictDoUpdate = vi.fn<(...args: any[]) => any>();

const mockDb = {
  select: vi.fn<(...args: any[]) => any>(() => ({
    from: vi.fn<(...args: any[]) => any>(() => ({
      where: mockWhere,
    })),
  })),
  insert: vi.fn<(...args: any[]) => any>(() => ({
    values: mockValues,
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
      expect(mockDb.select).toHaveBeenCalledWith({ categoryId: "category_id" });
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
      expect(mockValues).toHaveBeenCalledWith({
        id: "merchant-rule-1",
        userId: UserId,
        keyword: "restaurant",
        categoryId: CategoryId,
        createdAt: Now,
      });
      expect(mockOnConflictDoUpdate).toHaveBeenCalledWith({
        target: ["user_id", "keyword"],
        set: { categoryId: CategoryId, createdAt: Now },
      });
    });
  });
});
