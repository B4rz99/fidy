// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoryId, IsoDateTime, NotificationId, UserId } from "@/shared/types/branded";

const mockRun = vi.fn();
const mockAll = vi.fn().mockReturnValue([]);
const mockGet = vi.fn();
const mockOnConflictDoNothing = vi.fn().mockReturnValue({ run: mockRun });
const mockValues = vi.fn().mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing });
const mockInsert = vi.fn(() => ({ values: mockValues }));
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockReturnThis();
const mockOrderBy = vi.fn().mockReturnThis();
const mockLimit = vi.fn().mockReturnValue({ all: mockAll });

const mockDb = {
  insert: mockInsert,
  select: mockSelect,
} as any;

describe("notification repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRun.mockReturnValue(undefined);
    mockAll.mockReturnValue([]);
    mockGet.mockReturnValue({ count: 0 });
    mockOnConflictDoNothing.mockReturnValue({ run: mockRun });
    mockValues.mockReturnValue({ onConflictDoNothing: mockOnConflictDoNothing });
    mockInsert.mockReturnValue({ values: mockValues });
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy, get: mockGet });
    mockOrderBy.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ all: mockAll });
  });

  describe("insertNotification", () => {
    it("calls db.insert with the correct row and uses onConflictDoNothing", async () => {
      const { insertNotification } = await import("@/features/notifications/repository");

      const row = {
        id: "notif-1" as NotificationId,
        userId: "user-1" as UserId,
        type: "budget_alert" as const,
        dedupKey: "budget_alert:food:2026-03",
        categoryId: "food" as CategoryId,
        goalId: null,
        titleKey: "notifications.budgetAlert.title",
        messageKey: "notifications.budgetAlert.message",
        params: JSON.stringify({ category: "Food", percent: 80 }),
        createdAt: "2026-03-15T10:00:00.000Z" as IsoDateTime,
        updatedAt: "2026-03-15T10:00:00.000Z" as IsoDateTime,
        deletedAt: null,
      };

      insertNotification(mockDb, row);

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(row);
      expect(mockOnConflictDoNothing).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalled();
    });
  });

  describe("getNotifications", () => {
    it("returns notifications ordered by createdAt DESC with limit 50", async () => {
      const mockRows = [
        {
          id: "notif-1",
          userId: "user-1",
          type: "budget_alert",
          dedupKey: "budget_alert:food:2026-03",
          categoryId: "food",
          goalId: null,
          titleKey: "notifications.budgetAlert.title",
          messageKey: "notifications.budgetAlert.message",
          params: null,
          createdAt: "2026-03-15T10:00:00.000Z",
          updatedAt: "2026-03-15T10:00:00.000Z",
          deletedAt: null,
        },
      ];
      mockAll.mockReturnValueOnce(mockRows);

      const { getNotifications } = await import("@/features/notifications/repository");
      const result = getNotifications(mockDb, "user-1" as UserId);

      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
      expect(mockOrderBy).toHaveBeenCalled();
      expect(mockLimit).toHaveBeenCalledWith(50);
      expect(mockAll).toHaveBeenCalled();
      expect(result).toEqual(mockRows);
    });

    it("returns empty array when no notifications exist", async () => {
      mockAll.mockReturnValueOnce([]);

      const { getNotifications } = await import("@/features/notifications/repository");
      const result = getNotifications(mockDb, "user-1" as UserId);

      expect(result).toEqual([]);
    });
  });

  describe("countNotificationsSince", () => {
    it("counts all non-deleted notifications when since is null", async () => {
      mockGet.mockReturnValueOnce({ count: 3 });

      const { countNotificationsSince } = await import("@/features/notifications/repository");
      const result = countNotificationsSince(mockDb, "user-1" as UserId, null);

      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalled();
      expect(result).toBe(3);
    });

    it("returns count when since is provided", async () => {
      mockGet.mockReturnValueOnce({ count: 5 });

      const { countNotificationsSince } = await import("@/features/notifications/repository");
      const result = countNotificationsSince(
        mockDb,
        "user-1" as UserId,
        "2026-03-01T00:00:00.000Z" as IsoDateTime
      );

      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalled();
      expect(result).toBe(5);
    });
  });
});
