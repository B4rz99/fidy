// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getUndismissedSmsEvents,
  insertDetectedSmsEvent,
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

describe("capture-sources repository SMS events", () => {
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
      userId: "user-2" as UserId,
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
});
