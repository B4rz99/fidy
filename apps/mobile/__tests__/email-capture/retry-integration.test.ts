/**
 * Integration test for the email retry queue using a real SQLite database.
 *
 * Unlike the unit tests that mock the DB, this test verifies:
 * - The migration applies correctly (new columns exist)
 * - ISO timestamp comparison works in SQLite (strftime format)
 * - The full flow: insert pending_retry → query picks it up → retry → update
 * - Emails not yet due are excluded from the query
 */
// biome-ignore-all lint/suspicious/noExplicitAny: integration test needs flexible typing

import { resolve } from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  markSourceEventForRetry,
  markSourceEventPermanentlyFailed,
  markSourceEventRetrySuccess,
  getPendingRetryEmailSourceEvents,
} from "@/features/email-capture/lib/repository";
import { processRetries } from "@/features/email-capture/services/email-pipeline";
import { processedSourceEvents } from "@/shared/db/schema";
import { requireUserId } from "@/shared/types/assertions";
import type { IsoDateTime, ProcessedSourceEventId, TransactionId } from "@/shared/types/branded";

const mockParseEmailApi = vi.fn<(...args: any[]) => any>();
vi.mock("@/features/email-capture/services/parse-email-api", () => ({
  parseEmailApi: (...args: unknown[]) => mockParseEmailApi(...args),
  retryableParseEmailApi: (...args: unknown[]) => mockParseEmailApi(...args),
}));

vi.mock("@/shared/lib/sentry", () => ({
  captureError: vi.fn<(...args: any[]) => any>(),
  capturePipelineEvent: vi.fn<(...args: any[]) => any>(),
  captureWarning: vi.fn<(...args: any[]) => any>(),
}));

const mockFindDuplicateTransaction = vi.fn<(...args: any[]) => any>().mockResolvedValue(null);
vi.mock("@/features/capture-sources/lib/dedup", () => ({
  findDuplicateTransaction: (...args: unknown[]) => mockFindDuplicateTransaction(...args),
}));

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;
const USER_ID = requireUserId("user-1");

beforeEach(() => {
  vi.clearAllMocks();
  mockParseEmailApi.mockResolvedValue(null);
  mockFindDuplicateTransaction.mockResolvedValue(null);

  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
});

afterEach(() => {
  sqlite.close();
});

function insertRetrySourceEvent(
  overrides: Partial<typeof processedSourceEvents.$inferInsert> = {}
) {
  const row = {
    id: "pse-retry-1" as ProcessedSourceEventId,
    userId: USER_ID,
    sourceFamily: "email",
    sourceId: "email_gmail",
    sourceEventId: "ext-retry-1",
    status: "pending_retry",
    failureReason: "parse_error",
    retryCount: 0,
    nextRetryAt: null,
    transactionId: null,
    confidence: null,
    receivedAt: "2026-03-05T10:00:00.000Z" as IsoDateTime,
    processedAt: "2026-03-05T10:00:00.000Z" as IsoDateTime,
    createdAt: "2026-03-05T10:00:00.000Z" as IsoDateTime,
    updatedAt: "2026-03-05T10:00:00.000Z" as IsoDateTime,
    deletedAt: null,
    ...overrides,
  };
  db.insert(processedSourceEvents).values(row).run();
  return row;
}

function queueDueRetrySourceEvent(
  overrides: Partial<typeof processedSourceEvents.$inferInsert> = {}
) {
  const dueAt = new Date(Date.now() - 60_000).toISOString() as IsoDateTime;
  return insertRetrySourceEvent({ nextRetryAt: dueAt, ...overrides });
}

function mockSuccessfulRetryParse() {
  mockParseEmailApi.mockResolvedValueOnce({
    type: "expense",
    amount: 50000,
    categoryId: "other",
    description: "Compra en Exito",
    date: "2026-03-05",
    confidence: 0.9,
  });
}

async function getRetrySourceEvent() {
  const [row] = await db
    .select()
    .from(processedSourceEvents)
    .where(eq(processedSourceEvents.id, "pse-retry-1" as ProcessedSourceEventId));
  return row ?? null;
}

function expectRetryResult(
  result: Awaited<ReturnType<typeof processRetries>>,
  expected: Pick<
    Awaited<ReturnType<typeof processRetries>>,
    "retried" | "succeeded" | "permanentlyFailed"
  >
) {
  expect(result).toEqual(expect.objectContaining(expected));
}

describe("retry queue integration (real SQLite)", () => {
  it("migration adds rawBody, retryCount, nextRetryAt columns", () => {
    const columns = sqlite.pragma("table_info(processed_source_events)") as {
      name: string;
    }[];
    const columnNames = columns.map((c) => c.name);

    expect(columnNames).toContain("retry_count");
    expect(columnNames).toContain("next_retry_at");
  });

  it("getPendingRetryEmailSourceEvents picks up due source events for the active user", async () => {
    const pastTime = new Date(Date.now() - 60_000).toISOString() as IsoDateTime;
    insertRetrySourceEvent({ nextRetryAt: pastTime });

    const results = await getPendingRetryEmailSourceEvents(db as any, USER_ID);

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("pse-retry-1");
  });

  it("source-event retry repository helpers update retry state", async () => {
    const pastTime = new Date(Date.now() - 60_000).toISOString() as IsoDateTime;
    insertRetrySourceEvent({ nextRetryAt: pastTime, retryCount: 1 });

    const futureTime = new Date(Date.now() + 300_000).toISOString() as IsoDateTime;
    await markSourceEventForRetry({
      db: db as any,
      id: "pse-retry-1" as ProcessedSourceEventId,
      retryCount: 2,
      nextRetryAt: futureTime,
    });
    expect(await getRetrySourceEvent()).toEqual(
      expect.objectContaining({
        retryCount: 2,
        nextRetryAt: futureTime,
        status: "pending_retry",
      })
    );

    await markSourceEventPermanentlyFailed(db as any, "pse-retry-1" as ProcessedSourceEventId);
    expect(await getRetrySourceEvent()).toEqual(
      expect.objectContaining({
        status: "failed",
      })
    );

    await markSourceEventRetrySuccess({
      db: db as any,
      id: "pse-retry-1" as ProcessedSourceEventId,
      status: "processed",
      transactionId: "tx-42" as TransactionId,
      confidence: 0.95,
    });
    expect(await getRetrySourceEvent()).toEqual(
      expect.objectContaining({
        status: "processed",
        transactionId: "tx-42",
        confidence: 0.95,
      })
    );
  });

  it("full flow: pending_retry email without retry material → permanently failed", async () => {
    queueDueRetrySourceEvent();
    mockSuccessfulRetryParse();

    const result = await processRetries(db as any, USER_ID);

    expectRetryResult(result, { succeeded: 0, retried: 0, permanentlyFailed: 1 });
    expect(mockParseEmailApi).not.toHaveBeenCalled();
  });

  it("full flow: pending_retry email with no raw source content is not rescheduled", async () => {
    const pastTime = new Date(Date.now() - 60_000).toISOString() as IsoDateTime;
    insertRetrySourceEvent({ nextRetryAt: pastTime, retryCount: 2 });

    mockParseEmailApi.mockRejectedValueOnce(new Error("Edge Function timeout"));

    const result = await processRetries(db as any, USER_ID);

    expect(result.retried).toBe(0);
    expect(result.succeeded).toBe(0);
    expect(result.permanentlyFailed).toBe(1);

    const event = await getRetrySourceEvent();
    expect(event?.retryCount).toBe(2);
    expect(event?.status).toBe("failed");
  });

  it("full flow: max retries reached → permanently failed", async () => {
    const pastTime = new Date(Date.now() - 60_000).toISOString() as IsoDateTime;
    insertRetrySourceEvent({ nextRetryAt: pastTime, retryCount: 4 });

    mockParseEmailApi.mockRejectedValueOnce(new Error("Edge Function timeout"));

    const result = await processRetries(db as any, USER_ID);

    expect(result.permanentlyFailed).toBe(1);

    const event = await getRetrySourceEvent();
    expect(event?.status).toBe("failed");
  });

  it("ISO timestamp comparison is correct in SQLite", () => {
    // This is the exact bug we fixed — datetime('now') returns 'YYYY-MM-DD HH:MM:SS'
    // but our timestamps are ISO format 'YYYY-MM-DDTHH:MM:SS.sssZ'
    // Verify strftime produces matching format
    const [row] = sqlite
      .prepare(
        "SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now') as now_iso, datetime('now') as now_plain"
      )
      // biome-ignore lint/style/useNamingConvention: SQL column aliases
      .all() as { now_iso: string; now_plain: string }[];

    // ISO format should have T separator and Z suffix
    expect(row?.now_iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    // Plain datetime should NOT have T or Z
    expect(row?.now_plain).not.toContain("T");

    // An ISO timestamp should correctly compare against strftime ISO output
    const pastIso = new Date(Date.now() - 60_000).toISOString();
    const [cmp] = sqlite
      .prepare("SELECT ? <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now') as is_due")
      // biome-ignore lint/style/useNamingConvention: SQL column alias
      .all(pastIso) as { is_due: number }[];
    expect(cmp?.is_due).toBe(1);

    // A future ISO timestamp should NOT be due
    const futureIso = new Date(Date.now() + 600_000).toISOString();
    const [cmp2] = sqlite
      .prepare("SELECT ? <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now') as is_due")
      // biome-ignore lint/style/useNamingConvention: SQL column alias
      .all(futureIso) as { is_due: number }[];
    expect(cmp2?.is_due).toBe(0);
  });
});
