// biome-ignore-all lint/suspicious/noExplicitAny: mock db needs flexible typing
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DetectedSmsEventId,
  IsoDateTime,
  ProcessedCaptureId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: any[]) => ({ eq: args })),
  and: vi.fn((...args: any[]) => ({ and: args })),
  desc: vi.fn((...args: any[]) => ({ desc: args })),
  gte: vi.fn((...args: any[]) => ({ gte: args })),
  lt: vi.fn((...args: any[]) => ({ lt: args })),
  count: vi.fn(() => "count(*)"),
}));

vi.mock("date-fns", () => ({
  addDays: vi.fn((date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }),
}));

vi.mock("@/shared/db/schema", () => ({
  processedCaptures: {
    id: "processedCaptures.id",
    source: "processedCaptures.source",
    receivedAt: "processedCaptures.receivedAt",
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
  generateId: vi.fn(() => "ns-mock-id"),
  generateNotificationSourceId: () => "ns-mock-id",
}));

const mockOnConflictDoNothing = vi.fn().mockResolvedValue(undefined);
const mockOnConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
const mockValues = vi.fn().mockReturnThis();
const mockInsert = vi.fn(() => ({ values: mockValues }));
const mockSelect = vi.fn().mockReturnThis();
const mockFrom = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockReturnThis();
const mockLimit = vi.fn().mockResolvedValue([]);
const mockOrderBy = vi.fn().mockResolvedValue([]);
const mockUpdate = vi.fn().mockReturnThis();
const mockSet = vi.fn().mockReturnThis();
const mockUpdateWhere = vi.fn().mockResolvedValue([]);

const mockDb = {
  insert: mockInsert,
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  orderBy: mockOrderBy,
  update: mockUpdate,
} as any;

describe("capture-sources repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere, orderBy: mockOrderBy });
    mockWhere.mockReturnValue({ orderBy: mockOrderBy, limit: mockLimit });
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({
      onConflictDoNothing: mockOnConflictDoNothing,
      onConflictDoUpdate: mockOnConflictDoUpdate,
    });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockUpdateWhere });
  });

  // -- insertProcessedCapture --

  it("insertProcessedCapture calls db.insert with correct data", async () => {
    const { insertProcessedCapture } = await import("@/features/capture-sources/lib/repository");

    const row = {
      id: "pc-1" as ProcessedCaptureId,
      fingerprintHash: "abc123",
      source: "sms",
      status: "success",
      rawText: "Compra aprobada",
      transactionId: "tx-1" as TransactionId,
      confidence: 0.95,
      receivedAt: "2026-03-07T10:00:00Z" as IsoDateTime,
      createdAt: "2026-03-07T10:00:00Z" as IsoDateTime,
    };

    await insertProcessedCapture(mockDb, row);

    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(row);
    expect(mockOnConflictDoNothing).toHaveBeenCalled();
  });

  // -- hasProcessedCaptures --

  it("getProcessedCapturesBySource returns source rows newest first", async () => {
    const rows = [
      { id: "pc-2", source: "sms", receivedAt: "2026-03-07T11:00:00Z" },
      { id: "pc-1", source: "sms", receivedAt: "2026-03-07T10:00:00Z" },
    ];
    mockOrderBy.mockResolvedValueOnce(rows);

    const { getProcessedCapturesBySource } = await import(
      "@/features/capture-sources/lib/repository"
    );
    const result = await getProcessedCapturesBySource(mockDb, "sms");

    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalledWith({ eq: ["processedCaptures.source", "sms"] });
    expect(mockOrderBy).toHaveBeenCalledWith({ desc: ["processedCaptures.receivedAt"] });
    expect(result).toEqual(rows);
  });

  it("hasProcessedCaptures returns true when records exist", async () => {
    mockLimit.mockResolvedValueOnce([{ id: "pc-1" }]);

    const { hasProcessedCaptures } = await import("@/features/capture-sources/lib/repository");
    const result = await hasProcessedCaptures(mockDb, "sms");

    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
    expect(mockLimit).toHaveBeenCalledWith(1);
    expect(result).toBe(true);
  });

  it("hasProcessedCaptures returns false when empty", async () => {
    mockLimit.mockResolvedValueOnce([]);

    const { hasProcessedCaptures } = await import("@/features/capture-sources/lib/repository");
    const result = await hasProcessedCaptures(mockDb, "sms");

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
    const result = await getNotificationSources(mockDb, "user-1");

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
    const result = await getEnabledPackages(mockDb, "user-1");

    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
    expect(result).toEqual(["com.bank.app", "com.wallet.app"]);
  });

  // -- upsertNotificationSource --

  it("upsertNotificationSource calls db.insert with onConflictDoUpdate", async () => {
    const { upsertNotificationSource } = await import("@/features/capture-sources/lib/repository");

    await upsertNotificationSource(
      mockDb,
      "user-1",
      "com.bank.app",
      "Bank App",
      true,
      "2026-03-07T10:00:00Z"
    );

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
    const result = await getTodaySmsEventCount(mockDb, "user-1", new Date("2026-03-07T10:00:00Z"));

    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();
    expect(result).toBe(5);
  });

  it("getTodaySmsEventCount returns 0 when no events exist", async () => {
    mockWhere.mockResolvedValueOnce([{ total: 0 }]);

    const { getTodaySmsEventCount } = await import("@/features/capture-sources/lib/repository");
    const result = await getTodaySmsEventCount(mockDb, "user-1", new Date("2026-03-07T10:00:00Z"));

    expect(result).toBe(0);
  });

  // -- dismissSmsEvent --

  it("dismissSmsEvent calls db.update with correct where clause", async () => {
    const { dismissSmsEvent } = await import("@/features/capture-sources/lib/repository");

    await dismissSmsEvent(mockDb, "sms-1");

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith({ dismissed: true });
    expect(mockUpdateWhere).toHaveBeenCalled();
  });

  // -- linkSmsEventToTransaction --

  it("linkSmsEventToTransaction updates linkedTransactionId", async () => {
    const { linkSmsEventToTransaction } = await import("@/features/capture-sources/lib/repository");

    await linkSmsEventToTransaction(mockDb, "sms-1", "tx-123");

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith({
      linkedTransactionId: "tx-123",
      dismissed: true,
    });
    expect(mockUpdateWhere).toHaveBeenCalled();
  });
});
