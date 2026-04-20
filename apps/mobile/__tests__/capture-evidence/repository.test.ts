// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  countCaptureEvidenceOccurrences,
  getCaptureEvidenceById,
  getRepeatedCaptureEvidenceForUser,
  relinkCaptureEvidenceToTransfer,
  saveCaptureEvidence,
} from "@/features/capture-evidence";
import { getQueuedSyncEntries } from "@/features/transactions";
import type {
  CaptureEvidenceId,
  IsoDateTime,
  ProcessedCaptureId,
  ProcessedEmailId,
  TransactionId,
  TransferId,
  UserId,
} from "@/shared/types/branded";

let sqlite: InstanceType<typeof Database>;
let db: ReturnType<typeof drizzle>;

const USER_ID = "user-1" as UserId;
const NOW = "2026-04-19T10:00:00.000Z" as IsoDateTime;

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
});

afterEach(() => {
  sqlite.close();
});

describe("capture evidence repository", () => {
  it("saves evidence, enqueues sync, and counts repeated scoped evidence for one user", () => {
    saveCaptureEvidence(db as any, {
      id: "ce-1" as CaptureEvidenceId,
      userId: USER_ID,
      sourceFamily: "bancolombia",
      evidenceType: "last4",
      scope: "notification:bancolombia:last4",
      value: "1234",
      transactionId: "tx-1" as TransactionId,
      processedEmailId: null,
      processedCaptureId: "pc-1" as ProcessedCaptureId,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

    saveCaptureEvidence(db as any, {
      id: "ce-2" as CaptureEvidenceId,
      userId: USER_ID,
      sourceFamily: "bancolombia",
      evidenceType: "last4",
      scope: "notification:bancolombia:last4",
      value: "1234",
      transactionId: null,
      processedEmailId: null,
      processedCaptureId: "pc-2" as ProcessedCaptureId,
      createdAt: "2026-04-19T11:00:00.000Z" as IsoDateTime,
      updatedAt: "2026-04-19T11:00:00.000Z" as IsoDateTime,
      deletedAt: null,
    });

    saveCaptureEvidence(db as any, {
      id: "ce-3" as CaptureEvidenceId,
      userId: USER_ID,
      sourceFamily: "bancolombia",
      evidenceType: "sender_email",
      scope: "email:bancolombia:sender",
      value: "notificaciones@bancolombia.com.co",
      transactionId: "tx-3" as TransactionId,
      processedEmailId: "pe-1" as ProcessedEmailId,
      processedCaptureId: null,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

    saveCaptureEvidence(db as any, {
      id: "ce-4" as CaptureEvidenceId,
      userId: USER_ID,
      sourceFamily: "bancolombia",
      evidenceType: "last4",
      scope: "notification:bancolombia:last4",
      value: "1234",
      transactionId: null,
      processedEmailId: null,
      processedCaptureId: "pc-4" as ProcessedCaptureId,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: "2026-04-19T12:00:00.000Z" as IsoDateTime,
    });

    expect(
      countCaptureEvidenceOccurrences(db as any, USER_ID, "notification:bancolombia:last4", "1234")
    ).toBe(2);

    expect(getRepeatedCaptureEvidenceForUser(db as any, USER_ID, 2)).toEqual([
      {
        scope: "notification:bancolombia:last4",
        value: "1234",
        sourceFamily: "bancolombia",
        evidenceType: "last4",
        occurrences: 2,
      },
    ]);

    expect(getQueuedSyncEntries(db as any)).toEqual([
      expect.objectContaining({
        tableName: "captureEvidence",
        rowId: "ce-1",
        operation: "insert",
      }),
      expect.objectContaining({
        tableName: "captureEvidence",
        rowId: "ce-2",
        operation: "insert",
      }),
      expect.objectContaining({
        tableName: "captureEvidence",
        rowId: "ce-3",
        operation: "insert",
      }),
      expect.objectContaining({
        tableName: "captureEvidence",
        rowId: "ce-4",
        operation: "insert",
      }),
    ]);
  });

  it("ignores stale relink-to-transfer updates", () => {
    saveCaptureEvidence(db as any, {
      id: "ce-stale" as CaptureEvidenceId,
      userId: USER_ID,
      sourceFamily: "bancolombia",
      evidenceType: "last4",
      scope: "notification:bancolombia:last4",
      value: "1234",
      transactionId: "tx-1" as TransactionId,
      transferId: null,
      processedEmailId: null,
      processedCaptureId: "pc-stale" as ProcessedCaptureId,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

    relinkCaptureEvidenceToTransfer(
      db as any,
      "tx-1" as TransactionId,
      "tr-1" as TransferId,
      "2026-04-19T09:00:00.000Z" as IsoDateTime
    );

    expect(getCaptureEvidenceById(db as any, "ce-stale" as CaptureEvidenceId)).toEqual(
      expect.objectContaining({
        id: "ce-stale",
        transactionId: "tx-1",
        transferId: null,
        updatedAt: NOW,
      })
    );
  });

  it("rejects evidence rows linked to both a transaction and a transfer", () => {
    expect(() =>
      saveCaptureEvidence(db as any, {
        id: "ce-invalid" as CaptureEvidenceId,
        userId: USER_ID,
        sourceFamily: "bancolombia",
        evidenceType: "last4",
        scope: "notification:bancolombia:last4",
        value: "9999",
        transactionId: "tx-1" as TransactionId,
        transferId: "tr-1" as TransferId,
        processedEmailId: null,
        processedCaptureId: "pc-invalid" as ProcessedCaptureId,
        createdAt: NOW,
        updatedAt: NOW,
        deletedAt: null,
      })
    ).toThrow();
  });
});
