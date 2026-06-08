// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  insertDetectedSmsEvent,
  upsertNotificationSource,
} from "@/features/capture-sources/lib/repository";
import type { DetectedSmsEventId, IsoDateTime, UserId } from "@/shared/types/branded";

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

const USER_ID = "user-1" as UserId;
const CREATED_AT = "2026-04-01T00:00:00.000Z" as IsoDateTime;
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

describe("capture-sources repository SMS events", () => {
  it("inserts notification sources and detected SMS events", async () => {
    await insertNotificationSourceRow();
    await insertSmsEventRow();

    const sourceRows = sqlite
      .prepare("select package_name, label, is_enabled from notification_sources")
      .all();
    const smsRows = sqlite.prepare("select id, sender_label from detected_sms_events").all();

    expect(sourceRows).toEqual([
      { package_name: "com.bank.app", label: "Bank App", is_enabled: 1 },
    ]);
    expect(smsRows).toEqual([{ id: "sms-1", sender_label: "BankBot" }]);
  });
});
