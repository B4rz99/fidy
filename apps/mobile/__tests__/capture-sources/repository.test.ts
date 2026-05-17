// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  requireDetectedSmsEventId,
  requireIsoDateTime,
  requireTransactionId,
  requireUserId,
} from "@/shared/types/assertions";
import type { DetectedSmsEventId, IsoDateTime, UserId } from "@/shared/types/branded";

vi.mock("drizzle-orm", () => ({
  eq: vi.fn<(...args: any[]) => any>((...args: any[]) => ({ eq: args })),
  and: vi.fn<(...args: any[]) => any>((...args: any[]) => ({ and: args })),
  desc: vi.fn<(...args: any[]) => any>((...args: any[]) => ({ desc: args })),
  gte: vi.fn<(...args: any[]) => any>((...args: any[]) => ({ gte: args })),
  isNull: vi.fn<(...args: any[]) => any>((...args: any[]) => ({ isNull: args })),
  lt: vi.fn<(...args: any[]) => any>((...args: any[]) => ({ lt: args })),
  count: vi.fn<(...args: any[]) => any>(() => "count(*)"),
}));

vi.mock("date-fns", () => ({
  addDays: vi.fn<(...args: any[]) => any>((date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }),
}));

vi.mock("@/shared/db/schema", () => ({
  processedSourceEvents: {
    id: "processedSourceEvents.id",
    userId: "processedSourceEvents.userId",
    sourceFamily: "processedSourceEvents.sourceFamily",
    deletedAt: "processedSourceEvents.deletedAt",
  },
  notificationSources: {
    userId: "notificationSources.userId",
    packageName: "notificationSources.packageName",
    isEnabled: "notificationSources.isEnabled",
  },
  detectedSmsEvents: {
    id: "detectedSmsEvents.id",
    userId: "detectedSmsEvents.userId",
    dismissed: "detectedSmsEvents.dismissed",
    detectedAt: "detectedSmsEvents.detectedAt",
  },
}));

vi.mock("@/shared/lib/generate-id", () => ({
  generateId: vi.fn<(...args: any[]) => any>(() => "ns-mock-id"),
  generateNotificationSourceId: () => "ns-mock-id",
}));

const mockOnConflictDoUpdate = vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined);
const mockValues = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockInsert = vi.fn<(...args: any[]) => any>(() => ({ values: mockValues }));
const mockSelect = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockFrom = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockWhere = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockLimit = vi.fn<(...args: any[]) => any>().mockResolvedValue([]);
const mockOrderBy = vi.fn<(...args: any[]) => any>().mockResolvedValue([]);
const mockUpdate = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockSet = vi.fn<(...args: any[]) => any>().mockReturnThis();
const mockUpdateWhere = vi.fn<(...args: any[]) => any>().mockResolvedValue([]);

const mockDb = {
  insert: mockInsert,
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  orderBy: mockOrderBy,
  update: mockUpdate,
} as any;
const USER_ID = requireUserId("user-1");
const DETECTED_SMS_EVENT_ID = requireDetectedSmsEventId("sms-1");
const TRANSACTION_ID = requireTransactionId("tx-123");
const NOW = requireIsoDateTime("2026-03-07T10:00:00Z");

describe("capture-sources repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere, orderBy: mockOrderBy });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit });
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({
      onConflictDoUpdate: mockOnConflictDoUpdate,
    });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockUpdateWhere });
  });

  // -- hasProcessedSourceEventsBySource --

  it("hasProcessedSourceEventsBySource returns true when records exist", async () => {
    mockLimit.mockResolvedValueOnce([{ id: "pse-1" }]);

    const { hasProcessedSourceEventsBySource } =
      await import("@/features/capture-sources/lib/repository");
    const result = await hasProcessedSourceEventsBySource(mockDb, USER_ID, "apple_pay");

    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
    expect(mockLimit).toHaveBeenCalledWith(1);
    expect(result).toBe(true);
  });

  it("hasProcessedSourceEventsBySource returns false when empty", async () => {
    mockLimit.mockResolvedValueOnce([]);

    const { hasProcessedSourceEventsBySource } =
      await import("@/features/capture-sources/lib/repository");
    const result = await hasProcessedSourceEventsBySource(mockDb, USER_ID, "apple_pay");

    expect(result).toBe(false);
  });

  // -- getEnabledPackages --

  it("getNotificationSources returns rows for the requested user", async () => {
    const rows = [
      { id: "ns-1", userId: "user-1", packageName: "com.bank.app", isEnabled: true },
      { id: "ns-2", userId: "user-1", packageName: "com.wallet.app", isEnabled: false },
    ];
    mockWhere.mockResolvedValueOnce(rows);

    const { getNotificationSources } = await import("@/features/capture-sources/lib/repository");
    const result = await getNotificationSources(mockDb, USER_ID);

    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalledWith({ eq: ["notificationSources.userId", "user-1"] });
    expect(result).toEqual(rows);
  });

  it("getEnabledPackages returns array of package names", async () => {
    mockWhere.mockResolvedValueOnce([
      { packageName: "com.bank.app" },
      { packageName: "com.wallet.app" },
    ]);

    const { getEnabledPackages } = await import("@/features/capture-sources/lib/repository");
    const result = await getEnabledPackages(mockDb, USER_ID);

    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
    expect(result).toEqual(["com.bank.app", "com.wallet.app"]);
  });

  // -- upsertNotificationSource --

  it("upsertNotificationSource calls db.insert with onConflictDoUpdate", async () => {
    const { upsertNotificationSource } = await import("@/features/capture-sources/lib/repository");

    await upsertNotificationSource(mockDb, USER_ID, "com.bank.app", "Bank App", true, NOW);

    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "ns-mock-id",
        userId: "user-1",
        packageName: "com.bank.app",
        label: "Bank App",
        isEnabled: true,
      })
    );
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        set: { isEnabled: true, label: "Bank App" },
      })
    );
  });

  // -- insertDetectedSmsEvent --

  it("insertDetectedSmsEvent calls db.insert with correct data", async () => {
    // insertDetectedSmsEvent does NOT call onConflictDoNothing, just values()
    mockValues.mockResolvedValueOnce(undefined);

    const { insertDetectedSmsEvent } = await import("@/features/capture-sources/lib/repository");

    const row = {
      id: "sms-1" as DetectedSmsEventId,
      userId: "user-1" as UserId,
      senderLabel: "BankBot",
      detectedAt: "2026-03-07T10:00:00Z" as IsoDateTime,
      dismissed: false,
      linkedTransactionId: null,
      createdAt: "2026-03-07T10:00:00Z" as IsoDateTime,
    };

    await insertDetectedSmsEvent(mockDb, row);

    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(row);
  });

  // -- getTodaySmsEventCount --

  it("getTodaySmsEventCount returns count of today's undismissed events", async () => {
    mockWhere.mockResolvedValueOnce([{ total: 5 }]);

    const { getTodaySmsEventCount } = await import("@/features/capture-sources/lib/repository");
    const result = await getTodaySmsEventCount(mockDb, USER_ID, new Date("2026-03-07T10:00:00Z"));

    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
    expect(result).toBe(5);
  });

  it("getTodaySmsEventCount returns 0 when no events exist", async () => {
    mockWhere.mockResolvedValueOnce([{ total: 0 }]);

    const { getTodaySmsEventCount } = await import("@/features/capture-sources/lib/repository");
    const result = await getTodaySmsEventCount(mockDb, USER_ID, new Date("2026-03-07T10:00:00Z"));

    expect(result).toBe(0);
  });

  // -- dismissSmsEvent --

  it("dismissSmsEvent calls db.update with correct where clause", async () => {
    const { dismissSmsEvent } = await import("@/features/capture-sources/lib/repository");

    await dismissSmsEvent(mockDb, DETECTED_SMS_EVENT_ID);

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith({ dismissed: true });
    expect(mockUpdateWhere).toHaveBeenCalled();
  });

  // -- linkSmsEventToTransaction --

  it("linkSmsEventToTransaction updates linkedTransactionId", async () => {
    const { linkSmsEventToTransaction } = await import("@/features/capture-sources/lib/repository");

    await linkSmsEventToTransaction(mockDb, DETECTED_SMS_EVENT_ID, TRANSACTION_ID);

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith({
      linkedTransactionId: "tx-123",
      dismissed: true,
    });
    expect(mockUpdateWhere).toHaveBeenCalled();
  });
});
