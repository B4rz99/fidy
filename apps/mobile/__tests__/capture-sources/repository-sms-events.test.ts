// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getNotificationSources,
  getProcessedCapturesBySource,
  getUndismissedSmsEvents,
  insertDetectedSmsEvent,
  upsertNotificationSource,
} from "@/features/capture-sources/lib/repository";
import { processedCaptures } from "@/shared/db/schema";
import type {
  DetectedSmsEventId,
  IsoDateTime,
  ProcessedCaptureId,
  TransactionId,
  UserId,
} from "@/shared/types/branded";

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

const USER_ID = "user-1" as UserId;
const CREATED_AT = "2026-04-01T00:00:00.000Z" as IsoDateTime;
const OTHER_USER_ID = "user-2" as UserId;

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
});

afterEach(() => {
  sqlite.close();
});

const insertSmsEventRow = (
  overrides: Partial<{
    id: DetectedSmsEventId;
    userId: UserId;
    senderLabel: string;
    detectedAt: IsoDateTime;
    dismissed: boolean;
  }> = {}
) =>
  insertDetectedSmsEvent(db as any, {
    id: overrides.id ?? ("sms-1" as DetectedSmsEventId),
    userId: overrides.userId ?? USER_ID,
    senderLabel: overrides.senderLabel ?? "BankBot",
    detectedAt: overrides.detectedAt ?? ("2026-04-10T08:00:00.000Z" as IsoDateTime),
    dismissed: overrides.dismissed ?? false,
    linkedTransactionId: null,
    createdAt: CREATED_AT,
  });

const seedLegacyProcessedCaptureRow = (
  overrides: Partial<{
    id: ProcessedCaptureId;
    fingerprintHash: string;
    source: string;
    status: string;
    rawText: string | null;
    transactionId: TransactionId | null;
    confidence: number | null;
    receivedAt: IsoDateTime;
  }> = {}
) =>
  db
    .insert(processedCaptures)
    .values({
      id: overrides.id ?? ("pc-1" as ProcessedCaptureId),
      fingerprintHash: overrides.fingerprintHash ?? "hash-1",
      source: overrides.source ?? "sms",
      status: overrides.status ?? "accepted",
      rawText: overrides.rawText ?? "Compra aprobada",
      transactionId: overrides.transactionId ?? null,
      confidence: overrides.confidence ?? 0.9,
      receivedAt: overrides.receivedAt ?? ("2026-04-10T08:00:00.000Z" as IsoDateTime),
      createdAt: CREATED_AT,
    })
    .run();

const insertNotificationSourceRow = (
  overrides: Partial<{
    userId: UserId;
    packageName: string;
    label: string;
    isEnabled: boolean;
  }> = {}
) =>
  upsertNotificationSource(
    db as any,
    overrides.userId ?? USER_ID,
    overrides.packageName ?? "com.bank.app",
    overrides.label ?? "Bank App",
    overrides.isEnabled ?? true,
    CREATED_AT
  );

type NotificationSourceSeed = NonNullable<Parameters<typeof insertNotificationSourceRow>[0]>;

const insertNotificationSources = (sources: readonly NotificationSourceSeed[]) =>
  Promise.all(sources.map(insertNotificationSourceRow));

const mapNotificationSourceSummary = ({
  packageName,
  label,
  isEnabled,
}: {
  packageName: string;
  label: string;
  isEnabled: boolean;
}) => ({ packageName, label, isEnabled });

function expectNotificationSourceSummaries(
  sources: Awaited<ReturnType<typeof getNotificationSources>>,
  expected: readonly ReturnType<typeof mapNotificationSourceSummary>[]
) {
  expect(sources).toHaveLength(expected.length);
  expect(sources.map(mapNotificationSourceSummary)).toEqual(expect.arrayContaining([...expected]));
}

describe("capture-sources repository SMS events", () => {
  it("returns all notification sources for the requested user only", async () => {
    await insertNotificationSources([
      { packageName: "com.bank.app", label: "Bank App", isEnabled: true },
      { packageName: "com.wallet.app", label: "Wallet App", isEnabled: false },
      {
        userId: OTHER_USER_ID,
        packageName: "com.other.bank",
        label: "Other User App",
        isEnabled: true,
      },
    ]);

    expectNotificationSourceSummaries(await getNotificationSources(db as any, USER_ID), [
      { packageName: "com.bank.app", label: "Bank App", isEnabled: true },
      { packageName: "com.wallet.app", label: "Wallet App", isEnabled: false },
    ]);
  });

  it("returns only undismissed events for the current user in newest-first order", async () => {
    await insertSmsEventRow({
      id: "sms-1" as DetectedSmsEventId,
      senderLabel: "Older visible",
      detectedAt: "2026-04-10T08:00:00.000Z" as IsoDateTime,
    });
    await insertSmsEventRow({
      id: "sms-2" as DetectedSmsEventId,
      senderLabel: "Newest visible",
      detectedAt: "2026-04-10T11:30:00.000Z" as IsoDateTime,
    });
    await insertSmsEventRow({
      id: "sms-3" as DetectedSmsEventId,
      senderLabel: "Dismissed event",
      detectedAt: "2026-04-10T12:00:00.000Z" as IsoDateTime,
      dismissed: true,
    });
    await insertSmsEventRow({
      id: "sms-4" as DetectedSmsEventId,
      userId: OTHER_USER_ID,
      senderLabel: "Other user event",
      detectedAt: "2026-04-10T13:00:00.000Z" as IsoDateTime,
    });

    const events = await getUndismissedSmsEvents(db as any, USER_ID);

    expect(events.map(({ id }) => id)).toEqual(["sms-2", "sms-1"]);
    expect(events.map(({ senderLabel }) => senderLabel)).toEqual([
      "Newest visible",
      "Older visible",
    ]);
  });

  it("returns only captures for the requested source in newest-first order", async () => {
    await seedLegacyProcessedCaptureRow({
      id: "pc-1" as ProcessedCaptureId,
      fingerprintHash: "hash-1",
      source: "sms",
      receivedAt: "2026-04-10T08:00:00.000Z" as IsoDateTime,
      rawText: "Older SMS capture",
    });
    await seedLegacyProcessedCaptureRow({
      id: "pc-2" as ProcessedCaptureId,
      fingerprintHash: "hash-2",
      source: "push",
      receivedAt: "2026-04-10T09:30:00.000Z" as IsoDateTime,
      rawText: "Other source capture",
    });
    await seedLegacyProcessedCaptureRow({
      id: "pc-3" as ProcessedCaptureId,
      fingerprintHash: "hash-3",
      source: "sms",
      receivedAt: "2026-04-10T11:30:00.000Z" as IsoDateTime,
      rawText: "Newest SMS capture",
    });

    const captures = await getProcessedCapturesBySource(db as any, "sms");

    expect(captures.map(({ id }) => id)).toEqual(["pc-3", "pc-1"]);
    expect(captures.map(({ rawText }) => rawText)).toEqual([
      "Newest SMS capture",
      "Older SMS capture",
    ]);
  });
});
