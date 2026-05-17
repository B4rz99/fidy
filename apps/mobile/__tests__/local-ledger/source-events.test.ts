// biome-ignore-all lint/suspicious/noExplicitAny: fake drizzle db keeps test focused on persistence contract
import { getTableName } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnyDb } from "@/shared/db";
import {
  captureEvidence,
  processedSourceEvents,
  reviewCandidateCaptureEvidence,
  reviewCandidates,
} from "@/shared/db/schema";
import type { CopAmount, IsoDateTime, TransactionId, UserId } from "@/shared/types/branded";

vi.mock("@/shared/lib/generate-id", () => ({
  generateCaptureEvidenceId: vi.fn(() => "ce-1"),
  generateId: vi.fn((prefix: string) => `${prefix}-1`),
  generateProcessedSourceEventId: vi.fn(() => "pse-1"),
  generateReviewCandidateCaptureEvidenceId: vi.fn(() => "rcce-1"),
  generateReviewCandidateId: vi.fn(() => "rc-1"),
}));

const NOW = "2026-04-12T10:00:00.000Z" as IsoDateTime;
const USER_ID = "user-1" as UserId;

type InsertedRow = { readonly table: string; readonly row: any };

function makeDb(
  existingSourceEvent: any | null = null,
  options: { readonly failCaptureEvidenceInsert?: boolean } = {}
) {
  const inserted: InsertedRow[] = [];
  const sourceRows = existingSourceEvent ? [existingSourceEvent] : [];
  let transactionState: { inserted: InsertedRow[]; sourceRows: any[] } | null = null;
  let selectedTable: unknown = null;
  const activeInserted = () => transactionState?.inserted ?? inserted;
  const activeSourceRows = () => transactionState?.sourceRows ?? sourceRows;

  const db = {
    transaction: vi.fn((fn: (tx: AnyDb) => unknown) => {
      const previous = transactionState;
      const staged = {
        inserted: [] as InsertedRow[],
        sourceRows: activeSourceRows().map((row) => ({ ...row })),
      };
      transactionState = staged;
      try {
        const result = fn(db as AnyDb);
        sourceRows.splice(0, sourceRows.length, ...staged.sourceRows);
        inserted.push(...staged.inserted);
        return result;
      } finally {
        transactionState = previous;
      }
    }),
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => {
        selectedTable = table;
        return {
          where: vi.fn(() => ({
            limit: vi.fn(() => ({
              all: vi.fn(() =>
                selectedTable === processedSourceEvents
                  ? activeSourceRows().map((row) => ({ id: row.id, status: row.status }))
                  : []
              ),
            })),
          })),
        };
      }),
    })),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((row: any) => ({
        onConflictDoNothing: vi.fn(() => ({
          run: vi.fn(() => {
            if (table !== processedSourceEvents) return;
            const duplicate = activeSourceRows().some(
              (existing) =>
                existing.userId === row.userId &&
                existing.sourceFamily === row.sourceFamily &&
                existing.sourceId === row.sourceId &&
                existing.sourceEventId === row.sourceEventId &&
                existing.deletedAt === null
            );
            if (!duplicate) {
              activeSourceRows().push(row);
              activeInserted().push({ table: getTableName(table as never), row });
            }
          }),
        })),
        run: vi.fn(() => {
          if (table === captureEvidence && options.failCaptureEvidenceInsert) {
            throw new Error("capture evidence insert failed");
          }
          activeSourceRows().push(...(table === processedSourceEvents ? [row] : []));
          activeInserted().push({ table: getTableName(table as never), row });
        }),
      })),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((values: any) => ({
        where: vi.fn(() => ({
          run: vi.fn(() => {
            if (table !== processedSourceEvents) return;
            const row = activeSourceRows()[0];
            if (row) Object.assign(row, values);
            activeInserted().push({ table: getTableName(table as never), row: values });
          }),
        })),
      })),
    })),
  } as unknown as AnyDb;

  return { db, inserted };
}

const baseSource = {
  userId: USER_ID,
  sourceFamily: "notification",
  sourceId: "notification",
  sourceEventId: "fingerprint-1",
  status: "needs_review" as const,
  failureReason: "low_confidence",
  receivedAt: NOW,
  processedAt: NOW,
};

describe("Local Ledger source-event persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates needs-review source event, review candidate, evidence, and link atomically", async () => {
    const { recordReviewCandidateCaptureWithLocalLedger } =
      await import("@/infrastructure/local-ledger/review-candidate-capture");
    const { db, inserted } = makeDb();

    await recordReviewCandidateCaptureWithLocalLedger({
      db,
      ...baseSource,
      candidate: {
        occurredAt: NOW,
        amount: 12500 as CopAmount,
        description: "Low confidence cafe capture",
        confidence: 0.42,
      },
      evidence: [
        {
          sourceFamily: "notification",
          evidenceType: "counterparty_hint",
          scope: "merchant",
          value: "Cafe",
        },
      ],
    });

    expect(db.transaction).toHaveBeenCalledOnce();
    expect(inserted.map((entry) => entry.table)).toEqual([
      getTableName(processedSourceEvents),
      getTableName(reviewCandidates),
      getTableName(captureEvidence),
      getTableName(reviewCandidateCaptureEvidence),
    ]);
    expect(inserted[1]?.row).toEqual(
      expect.objectContaining({ processedSourceEventId: "pse-1", status: "pending" })
    );
  });

  it("does not create child rows when the source event already exists", async () => {
    const { recordReviewCandidateCaptureWithLocalLedger } =
      await import("@/infrastructure/local-ledger/review-candidate-capture");
    const { db, inserted } = makeDb({
      id: "pse-existing",
      ...baseSource,
      deletedAt: null,
    });

    await recordReviewCandidateCaptureWithLocalLedger({
      db,
      ...baseSource,
      candidate: {
        occurredAt: NOW,
        amount: 12500 as CopAmount,
        description: "Low confidence cafe capture",
        confidence: 0.42,
      },
      evidence: [],
    });

    expect(inserted).toEqual([]);
  });

  it("rejects review candidate persistence for non-review source-event status", async () => {
    const { recordReviewCandidateCaptureWithLocalLedger } =
      await import("@/infrastructure/local-ledger/review-candidate-capture");
    const { db, inserted } = makeDb();

    await expect(
      recordReviewCandidateCaptureWithLocalLedger({
        db,
        ...baseSource,
        status: "processed",
        failureReason: null,
        candidate: {
          occurredAt: NOW,
          amount: 12500 as CopAmount,
          description: "Contradictory review candidate",
          confidence: 1,
        },
        evidence: [],
      } as any)
    ).rejects.toThrow("Review candidate captures must use needs_review source-event status");
    expect(db.transaction).not.toHaveBeenCalled();
    expect(inserted).toEqual([]);
  });

  it("does not link committed-capture evidence to a generated orphan source event on conflict", async () => {
    const { persistCommittedCaptureSourceEvent } =
      await import("@/infrastructure/local-ledger/source-events");
    const { db, inserted } = makeDb({
      id: "pse-existing",
      ...baseSource,
      deletedAt: null,
    });

    persistCommittedCaptureSourceEvent(db, {
      ...baseSource,
      status: "processed",
      failureReason: null,
      transactionId: "tx-1" as TransactionId,
      evidence: [
        {
          sourceFamily: "notification",
          evidenceType: "counterparty_hint",
          scope: "merchant",
          value: "Cafe",
        },
      ],
    });

    expect(inserted).toEqual([]);
  });

  it("promotes a failed source event and records committed-capture evidence on retry", async () => {
    const { persistCommittedCaptureSourceEvent } =
      await import("@/infrastructure/local-ledger/source-events");
    const { db, inserted } = makeDb({
      id: "pse-existing",
      ...baseSource,
      status: "failed",
      deletedAt: null,
    });

    persistCommittedCaptureSourceEvent(db, {
      ...baseSource,
      status: "processed",
      failureReason: null,
      transactionId: "tx-1" as TransactionId,
      evidence: [
        {
          sourceFamily: "notification",
          evidenceType: "counterparty_hint",
          scope: "merchant",
          value: "Cafe",
        },
      ],
    });

    expect(inserted.map((entry) => entry.table)).toEqual([
      getTableName(processedSourceEvents),
      getTableName(captureEvidence),
    ]);
    expect(inserted[1]?.row).toEqual(
      expect.objectContaining({
        processedSourceEventId: "pse-existing",
        transactionId: "tx-1",
      })
    );
  });

  it("persists committed source event and capture evidence inside one transaction", async () => {
    const { persistCommittedCaptureSourceEvent } =
      await import("@/infrastructure/local-ledger/source-events");
    const { db, inserted } = makeDb();

    persistCommittedCaptureSourceEvent(db, {
      ...baseSource,
      status: "processed",
      failureReason: null,
      transactionId: "tx-1" as TransactionId,
      evidence: [
        {
          sourceFamily: "notification",
          evidenceType: "counterparty_hint",
          scope: "merchant",
          value: "Cafe",
        },
      ],
    });

    expect(db.transaction).toHaveBeenCalledOnce();
    expect(inserted.map((entry) => entry.table)).toEqual([
      getTableName(processedSourceEvents),
      getTableName(captureEvidence),
    ]);
  });

  it("propagates committed-capture evidence insert failures from the transaction boundary", async () => {
    const { persistCommittedCaptureSourceEvent } =
      await import("@/infrastructure/local-ledger/source-events");
    const { db, inserted } = makeDb(null, { failCaptureEvidenceInsert: true });

    expect(() =>
      persistCommittedCaptureSourceEvent(db, {
        ...baseSource,
        status: "processed",
        failureReason: null,
        transactionId: "tx-1" as TransactionId,
        evidence: [
          {
            sourceFamily: "notification",
            evidenceType: "counterparty_hint",
            scope: "merchant",
            value: "Cafe",
          },
        ],
      })
    ).toThrow("capture evidence insert failed");
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(inserted).toEqual([]);
  });
});
