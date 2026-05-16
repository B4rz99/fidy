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

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPendingRetryEmails,
  markForRetry,
  markPermanentlyFailed,
  markRetrySuccess,
} from "@/features/email-capture/lib/repository";
import { processRetries } from "@/features/email-capture/services/email-pipeline";
import { processedEmails, processedSourceEvents, transactions } from "@/shared/db/schema";
import { requireUserId } from "@/shared/types/assertions";
import type { IsoDateTime, ProcessedEmailId, TransactionId } from "@/shared/types/branded";

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
const retryMigrationSql = readFileSync(
  resolve(__dirname, "../../drizzle/0028_source_event_email_retry.sql"),
  "utf8"
).replaceAll("--> statement-breakpoint", "");

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

function insertRetryEmail(overrides: Partial<typeof processedEmails.$inferInsert> = {}) {
  const retryRawBody =
    overrides.rawBody === undefined
      ? "Su compra por $50.000 fue aprobada en EXITO"
      : overrides.rawBody;
  const nextRetryAt = overrides.nextRetryAt ?? null;
  const retryCount = overrides.retryCount ?? 0;
  const status = overrides.status ?? "pending_retry";
  const externalId = overrides.externalId ?? "ext-retry-1";
  const receivedAt = (overrides.receivedAt ?? "2026-03-05T10:00:00.000Z") as IsoDateTime;
  const row = {
    id: "pe-retry-1" as ProcessedEmailId,
    externalId,
    provider: "gmail",
    status,
    failureReason: "parse_error",
    subject: "Compra aprobada",
    rawBodyPreview: "Su compra por $50.000...",
    rawBody: retryRawBody,
    receivedAt,
    transactionId: null,
    confidence: null,
    retryCount,
    createdAt: "2026-03-05T10:00:00.000Z" as IsoDateTime,
    nextRetryAt,
    ...overrides,
  };
  db.insert(processedEmails).values(row).run();
  db.insert(processedSourceEvents).values(toRetrySourceEvent(row)).run();
  return row;
}

function toRetrySourceEvent(row: typeof processedEmails.$inferInsert) {
  return {
    id: "pse-retry-1" as any,
    userId: USER_ID,
    sourceFamily: "email",
    sourceId: "email_gmail",
    sourceEventId: row.externalId,
    status: row.status,
    failureReason: "parse_error",
    receivedAt: row.receivedAt,
    processedAt: "2026-03-05T10:00:00.000Z" as IsoDateTime,
    retryRawBody: row.rawBody ?? null,
    retryCount: row.retryCount ?? 0,
    nextRetryAt: row.nextRetryAt ?? null,
    retryTransactionId: null,
    retryConfidence: null,
    createdAt: "2026-03-05T10:00:00.000Z" as IsoDateTime,
    updatedAt: "2026-03-05T10:00:00.000Z" as IsoDateTime,
    deletedAt: null,
  };
}

function queueDueRetryEmail(overrides: Partial<typeof processedEmails.$inferInsert> = {}) {
  const dueAt = new Date(Date.now() - 60_000).toISOString() as IsoDateTime;
  return insertRetryEmail({ nextRetryAt: dueAt, ...overrides });
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

async function getRetryEmail() {
  const [row] = await db
    .select()
    .from(processedEmails)
    .where(eq(processedEmails.id, "pe-retry-1" as ProcessedEmailId));
  return row ?? null;
}

async function getRetrySourceEvent() {
  const [row] = await db
    .select()
    .from(processedSourceEvents)
    .where(eq(processedSourceEvents.id, "pse-retry-1" as any));
  return row ?? null;
}

async function getInsertedTransactions() {
  return db.select().from(transactions);
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

async function expectSuccessfulRetryArtifacts() {
  const [txRow] = await getInsertedTransactions();
  expect(txRow).toEqual(
    expect.objectContaining({
      amount: 50000,
      source: "email_capture",
      accountId: `fa-default-${USER_ID}`,
      accountAttributionState: "unresolved",
    })
  );

  expect(await getRetryEmail()).toEqual(
    expect.objectContaining({
      status: "pending_retry",
      rawBody: "Su compra por $50.000 fue aprobada en EXITO",
      transactionId: null,
    })
  );
  expect(await getRetrySourceEvent()).toEqual(
    expect.objectContaining({
      status: "success",
      retryRawBody: null,
      retryTransactionId: txRow?.id,
    })
  );
}

describe("retry queue integration (real SQLite)", () => {
  it("migration adds source-event retry columns", () => {
    const columns = sqlite.pragma("table_info(processed_source_events)") as {
      name: string;
    }[];
    const columnNames = columns.map((c) => c.name);

    expect(columnNames).toContain("retry_raw_body");
    expect(columnNames).toContain("retry_count");
    expect(columnNames).toContain("next_retry_at");
    expect(columnNames).toContain("retry_transaction_id");
    expect(columnNames).toContain("retry_confidence");
  });

  it("migration backfills existing legacy pending retries into source events", () => {
    const legacySqlite = new Database(":memory:");
    const longLegacyRawBody = "x".repeat(6_000);
    try {
      legacySqlite.exec(`
        create table email_accounts (
          id text primary key,
          user_id text not null,
          provider text not null,
          email text not null,
          last_fetched_at text,
          created_at text not null
        );
        create table processed_emails (
          id text primary key,
          external_id text not null,
          provider text not null,
          status text not null,
          failure_reason text,
          subject text not null,
          raw_body_preview text,
          received_at text not null,
          transaction_id text,
          confidence real,
          created_at text not null,
          raw_body text,
          retry_count integer default 0 not null,
          next_retry_at text
        );
        create table processed_source_events (
          id text primary key,
          user_id text not null,
          source_family text not null,
          source_id text not null,
          source_event_id text not null,
          status text not null,
          failure_reason text,
          received_at text not null,
          processed_at text not null,
          created_at text not null,
          updated_at text not null,
          deleted_at text
        );
        create unique index uq_processed_source_event
          on processed_source_events (user_id, source_family, source_id, source_event_id)
          where deleted_at is null;
        insert into email_accounts values (
          'ea-1',
          '${USER_ID}',
          'gmail',
          'user@example.com',
          null,
          '2026-03-01T10:00:00.000Z'
        );
        insert into processed_emails values (
          'pe-legacy-1',
          'gmail-legacy-1',
          'gmail',
          'pending_retry',
          'parse_error',
          'Compra aprobada',
          'preview',
          '2026-03-05T10:00:00.000Z',
          null,
          null,
          '2026-03-05T10:01:00.000Z',
          '${longLegacyRawBody}',
          2,
          '2026-03-05T10:05:00.000Z'
        );
      `);

      legacySqlite.exec(retryMigrationSql);

      const rows = legacySqlite
        .prepare("select * from processed_source_events where source_event_id = ?")
        .all("gmail-legacy-1") as Record<string, unknown>[];

      expect(rows).toEqual([
        expect.objectContaining({
          id: "pse_legacy_retry_pe-legacy-1",
          user_id: USER_ID,
          source_family: "email",
          source_id: "email_gmail",
          status: "pending_retry",
          retry_raw_body: "x".repeat(5_000),
          retry_count: 2,
          next_retry_at: "2026-03-05T10:05:00.000Z",
        }),
      ]);
    } finally {
      legacySqlite.close();
    }
  });

  it("getPendingRetryEmails picks up emails with nextRetryAt in the past", async () => {
    const pastTime = new Date(Date.now() - 60_000).toISOString() as IsoDateTime;
    insertRetryEmail({ nextRetryAt: pastTime });

    const results = await getPendingRetryEmails(db as any, USER_ID);

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("pse-retry-1");
    expect(results[0]?.rawBody).toBe("Su compra por $50.000 fue aprobada en EXITO");
  });

  it("getPendingRetryEmails excludes emails with nextRetryAt in the future", async () => {
    const futureTime = new Date(Date.now() + 600_000).toISOString() as IsoDateTime;
    insertRetryEmail({ nextRetryAt: futureTime });

    const results = await getPendingRetryEmails(db as any, USER_ID);

    expect(results).toHaveLength(0);
  });

  it("getPendingRetryEmails excludes non-pending_retry statuses", async () => {
    const pastTime = new Date(Date.now() - 60_000).toISOString() as IsoDateTime;
    insertRetryEmail({
      id: "pe-failed" as ProcessedEmailId,
      externalId: "ext-failed",
      status: "failed",
      nextRetryAt: pastTime,
    });

    const results = await getPendingRetryEmails(db as any, USER_ID);

    expect(results).toHaveLength(0);
  });

  it("markForRetry updates retryCount and nextRetryAt without touching rawBody", async () => {
    const pastTime = new Date(Date.now() - 60_000).toISOString() as IsoDateTime;
    insertRetryEmail({ nextRetryAt: pastTime, retryCount: 1 });

    const futureTime = new Date(Date.now() + 300_000).toISOString() as IsoDateTime;
    await markForRetry({
      db: db as any,
      id: "pse-retry-1" as ProcessedEmailId,
      retryCount: 2,
      nextRetryAt: futureTime,
    });

    const sourceEvent = await getRetrySourceEvent();
    expect(sourceEvent?.retryCount).toBe(2);
    expect(sourceEvent?.nextRetryAt).toBe(futureTime);
    expect(sourceEvent?.retryRawBody).toBe("Su compra por $50.000 fue aprobada en EXITO");
    expect(sourceEvent?.status).toBe("pending_retry");

    const legacyEmail = await getRetryEmail();
    expect(legacyEmail?.retryCount).toBe(1);
    expect(legacyEmail?.nextRetryAt).toBe(pastTime);
    expect(legacyEmail?.rawBody).toBe("Su compra por $50.000 fue aprobada en EXITO");
  });

  it("markPermanentlyFailed sets status=failed and clears rawBody", async () => {
    insertRetryEmail({ nextRetryAt: new Date().toISOString() as IsoDateTime });

    await markPermanentlyFailed(db as any, "pse-retry-1" as ProcessedEmailId);

    const sourceEvent = await getRetrySourceEvent();
    expect(sourceEvent?.status).toBe("failed");
    expect(sourceEvent?.retryRawBody).toBeNull();

    const legacyEmail = await getRetryEmail();
    expect(legacyEmail?.status).toBe("pending_retry");
    expect(legacyEmail?.rawBody).toBe("Su compra por $50.000 fue aprobada en EXITO");
  });

  it("markRetrySuccess sets status/transactionId/confidence and clears rawBody", async () => {
    insertRetryEmail({ nextRetryAt: new Date().toISOString() as IsoDateTime });

    await markRetrySuccess({
      db: db as any,
      id: "pse-retry-1" as ProcessedEmailId,
      status: "success",
      transactionId: "tx-42" as TransactionId,
      confidence: 0.95,
    });

    const sourceEvent = await getRetrySourceEvent();
    expect(sourceEvent?.status).toBe("success");
    expect(sourceEvent?.retryTransactionId).toBe("tx-42");
    expect(sourceEvent?.retryConfidence).toBe(0.95);
    expect(sourceEvent?.retryRawBody).toBeNull();

    const legacyEmail = await getRetryEmail();
    expect(legacyEmail?.status).toBe("pending_retry");
    expect(legacyEmail?.transactionId).toBeNull();
    expect(legacyEmail?.confidence).toBeNull();
    expect(legacyEmail?.rawBody).toBe("Su compra por $50.000 fue aprobada en EXITO");
  });

  it("full flow: pending_retry email → successful retry → transaction created", async () => {
    queueDueRetryEmail();
    mockSuccessfulRetryParse();

    const result = await processRetries(db as any, USER_ID);

    expectRetryResult(result, { succeeded: 1, retried: 0, permanentlyFailed: 0 });
    expect(mockParseEmailApi).toHaveBeenCalledWith("Su compra por $50.000 fue aprobada en EXITO");
    await expectSuccessfulRetryArtifacts();
  });

  async function expectRetryRescheduled() {
    const pe = await getRetrySourceEvent();
    expect(pe?.retryCount).toBe(3);
    expect(pe?.status).toBe("pending_retry");
    expect(pe?.retryRawBody).toBe("Su compra por $50.000 fue aprobada en EXITO");

    const nextRetry = new Date(pe?.nextRetryAt ?? "");
    expect(nextRetry.getTime()).toBeGreaterThan(Date.now());
  }

  it("full flow: pending_retry email → parse fails again → rescheduled with backoff", async () => {
    const pastTime = new Date(Date.now() - 60_000).toISOString() as IsoDateTime;
    insertRetryEmail({ nextRetryAt: pastTime, retryCount: 2 });

    mockParseEmailApi.mockRejectedValueOnce(new Error("Edge Function timeout"));

    const result = await processRetries(db as any, USER_ID);

    expect(result.retried).toBe(1);
    expect(result.succeeded).toBe(0);
    await expectRetryRescheduled();
  });

  it("full flow: max retries reached → permanently failed", async () => {
    const pastTime = new Date(Date.now() - 60_000).toISOString() as IsoDateTime;
    insertRetryEmail({ nextRetryAt: pastTime, retryCount: 4 });

    mockParseEmailApi.mockRejectedValueOnce(new Error("Edge Function timeout"));

    const result = await processRetries(db as any, USER_ID);

    expect(result.permanentlyFailed).toBe(1);

    const pe = await getRetrySourceEvent();
    expect(pe?.status).toBe("failed");
    expect(pe?.retryRawBody).toBeNull();
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
