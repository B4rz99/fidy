import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
}));

vi.mock("@/shared/db/schema", () => ({
  merchantRules: {
    categoryId: "category_id",
    userId: "user_id",
    senderEmail: "sender_email",
    keyword: "keyword",
  },
}));

const mockWhere = vi.fn();
const mockOnConflictDoNothing = vi.fn();

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: mockWhere,
    })),
  })),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      onConflictDoNothing: mockOnConflictDoNothing,
    })),
  })),
} as any;

import {
  insertMerchantRule,
  lookupMerchantRule,
} from "../../features/email-capture/lib/merchant-rules";

describe("merchant-rules", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("lookupMerchantRule", () => {
    it("returns categoryId when found", async () => {
      mockWhere.mockResolvedValue([{ categoryId: "food" }]);
      const result = await lookupMerchantRule(mockDb, "user1", "noreply@bank.com", "restaurant");
      expect(result).toBe("food");
    });

    it("returns null when not found", async () => {
      mockWhere.mockResolvedValue([]);
      const result = await lookupMerchantRule(mockDb, "user1", "noreply@bank.com", "unknown");
      expect(result).toBeNull();
    });
  });

  describe("insertMerchantRule", () => {
    it("calls insert with correct values", async () => {
      mockOnConflictDoNothing.mockResolvedValue(undefined);
      await insertMerchantRule(
        mockDb,
        "user1",
        "noreply@bank.com",
        "restaurant",
        "food",
        "2026-03-07T10:00:00Z"
      );
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });
});
