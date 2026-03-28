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
  getPendingRetryEmails,
  markForRetry,
  markPermanentlyFailed,
  markRetrySuccess,
} from "@/features/email-capture/lib/repository";
import { processRetries } from "@/features/email-capture/services/email-pipeline";
import { processedEmails, syncQueue, transactions } from "@/shared/db/schema";
import type { IsoDateTime, ProcessedEmailId, TransactionId } from "@/shared/types/branded";

const mockParseEmailApi = vi.fn();
vi.mock("@/features/email-capture/services/parse-email-api", () => ({
  parseEmailApi: (...args: unknown[]) => mockParseEmailApi(...args),
}));

vi.mock("@/shared/lib/sentry", () => ({
  captureError: vi.fn(),
  capturePipelineEvent: vi.fn(),
  captureWarning: vi.fn(),
}));

const mockFindDuplicateTransaction = vi.fn().mockResolvedValue(null);
vi.mock("@/features/capture-sources/lib/dedup", () => ({
  findDuplicateTransaction: (...args: unknown[]) => mockFindDuplicateTransaction(...args),
}));

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

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
  const row = {
    id: "pe-retry-1" as ProcessedEmailId,
    externalId: "ext-retry-1",
    provider: "gmail",
    status: "pending_retry",
    failureReason: "parse_error",
    subject: "Compra aprobada",
    rawBodyPreview: "Su compra por $50.000...",
    rawBody: "Su compra por $50.000 fue aprobada en EXITO",
    receivedAt: "2026-03-05T10:00:00.000Z" as IsoDateTime,
    transactionId: null,
    confidence: null,
    retryCount: 0,
    createdAt: "2026-03-05T10:00:00.000Z" as IsoDateTime,
    ...overrides,
  };
  db.insert(processedEmails).values(row).run();
  return row;
}

describe("retry queue integration (real SQLite)", () => {
  it("migration adds rawBody, retryCount, nextRetryAt columns", () => {
    const columns = sqlite.pragma("table_info(processed_emails)") as {
      name: string;
    }[];
    const columnNames = columns.map((c) => c.name);

    expect(columnNames).toContain("raw_body");
    expect(columnNames).toContain("retry_count");
    expect(columnNames).toContain("next_retry_at");
  });

  it("getPendingRetryEmails picks up emails with nextRetryAt in the past", async () => {
    const pastTime = new Date(Date.now() - 60_000).toISOString() as IsoDateTime;
    insertRetryEmail({ nextRetryAt: pastTime });

    const results = await getPendingRetryEmails(db as any);

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("pe-retry-1");
    expect(results[0]?.rawBody).toBe("Su compra por $50.000 fue aprobada en EXITO");
  });

  it("getPendingRetryEmails excludes emails with nextRetryAt in the future", async () => {
    const futureTime = new Date(Date.now() + 600_000).toISOString() as IsoDateTime;
    insertRetryEmail({ nextRetryAt: futureTime });

    const results = await getPendingRetryEmails(db as any);

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

    const results = await getPendingRetryEmails(db as any);

    expect(results).toHaveLength(0);
  });

  it("markForRetry updates retryCount and nextRetryAt without touching rawBody", async () => {
    const pastTime = new Date(Date.now() - 60_000).toISOString() as IsoDateTime;
    insertRetryEmail({ nextRetryAt: pastTime, retryCount: 1 });

    const futureTime = new Date(Date.now() + 300_000).toISOString() as IsoDateTime;
    await markForRetry(db as any, "pe-retry-1" as ProcessedEmailId, 2, futureTime);

    const [row] = await db
      .select()
      .from(processedEmails)
      .where(eq(processedEmails.id, "pe-retry-1" as ProcessedEmailId));
    expect(row?.retryCount).toBe(2);
    expect(row?.nextRetryAt).toBe(futureTime);
    expect(row?.rawBody).toBe("Su compra por $50.000 fue aprobada en EXITO");
    expect(row?.status).toBe("pending_retry");
  });

  it("markPermanentlyFailed sets status=failed and clears rawBody", async () => {
    insertRetryEmail({ nextRetryAt: new Date().toISOString() as IsoDateTime });

    await markPermanentlyFailed(db as any, "pe-retry-1" as ProcessedEmailId);

    const [row] = await db
      .select()
      .from(processedEmails)
      .where(eq(processedEmails.id, "pe-retry-1" as ProcessedEmailId));
    expect(row?.status).toBe("failed");
    expect(row?.rawBody).toBeNull();
  });

  it("markRetrySuccess sets status/transactionId/confidence and clears rawBody", async () => {
    insertRetryEmail({ nextRetryAt: new Date().toISOString() as IsoDateTime });

    await markRetrySuccess(
      db as any,
      "pe-retry-1" as ProcessedEmailId,
      "success",
      "tx-42" as TransactionId,
      0.95
    );

    const [row] = await db
      .select()
      .from(processedEmails)
      .where(eq(processedEmails.id, "pe-retry-1" as ProcessedEmailId));
    expect(row?.status).toBe("success");
    expect(row?.transactionId).toBe("tx-42");
    expect(row?.confidence).toBe(0.95);
    expect(row?.rawBody).toBeNull();
  });

  it("full flow: pending_retry email → successful retry → transaction created", async () => {
    const pastTime = new Date(Date.now() - 60_000).toISOString() as IsoDateTime;
    insertRetryEmail({ nextRetryAt: pastTime });

    mockParseEmailApi.mockResolvedValueOnce({
      type: "expense",
      amount: 50000,
      categoryId: "other",
      description: "Compra en Exito",
      date: "2026-03-05",
      confidence: 0.9,
    });

    const result = await processRetries(db as any, "user-1");

    expect(result.succeeded).toBe(1);
    expect(result.retried).toBe(0);
    expect(result.permanentlyFailed).toBe(0);

    // Verify parseEmailApi was called with the cached rawBody
    expect(mockParseEmailApi).toHaveBeenCalledWith("Su compra por $50.000 fue aprobada en EXITO");

    // Verify transaction was created in DB
    const txRows = await db.select().from(transactions);
    expect(txRows).toHaveLength(1);
    expect(txRows[0]?.amount).toBe(50000);
    expect(txRows[0]?.source).toBe("email_gmail");

    // Verify sync queue entry
    const syncRows = await db.select().from(syncQueue);
    expect(syncRows).toHaveLength(1);
    expect(syncRows[0]?.tableName).toBe("transactions");

    // Verify processed email was updated
    const [pe] = await db
      .select()
      .from(processedEmails)
      .where(eq(processedEmails.id, "pe-retry-1" as ProcessedEmailId));
    expect(pe?.status).toBe("success");
    expect(pe?.rawBody).toBeNull();
    expect(pe?.transactionId).toBe(txRows[0]?.id);
  });

  it("full flow: pending_retry email → parse fails again → rescheduled with backoff", async () => {
    const pastTime = new Date(Date.now() - 60_000).toISOString() as IsoDateTime;
    insertRetryEmail({ nextRetryAt: pastTime, retryCount: 2 });

    mockParseEmailApi.mockRejectedValueOnce(new Error("Edge Function timeout"));

    const result = await processRetries(db as any, "user-1");

    expect(result.retried).toBe(1);
    expect(result.succeeded).toBe(0);

    // Verify retryCount incremented and nextRetryAt pushed forward
    const [pe] = await db
      .select()
      .from(processedEmails)
      .where(eq(processedEmails.id, "pe-retry-1" as ProcessedEmailId));
    expect(pe?.retryCount).toBe(3);
    expect(pe?.status).toBe("pending_retry");
    expect(pe?.rawBody).toBe("Su compra por $50.000 fue aprobada en EXITO");

    // nextRetryAt should be in the future
    const nextRetry = new Date(pe?.nextRetryAt ?? "");
    expect(nextRetry.getTime()).toBeGreaterThan(Date.now());
  });

  it("full flow: max retries reached → permanently failed", async () => {
    const pastTime = new Date(Date.now() - 60_000).toISOString() as IsoDateTime;
    insertRetryEmail({ nextRetryAt: pastTime, retryCount: 4 });

    mockParseEmailApi.mockRejectedValueOnce(new Error("Edge Function timeout"));

    const result = await processRetries(db as any, "user-1");

    expect(result.permanentlyFailed).toBe(1);

    const [pe] = await db
      .select()
      .from(processedEmails)
      .where(eq(processedEmails.id, "pe-retry-1" as ProcessedEmailId));
    expect(pe?.status).toBe("failed");
    expect(pe?.rawBody).toBeNull();
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
