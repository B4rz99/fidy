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
const LATER = "2026-04-19T11:00:00.000Z" as IsoDateTime;

type CaptureEvidenceInput = Parameters<typeof saveCaptureEvidence>[1];

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: resolve(__dirname, "../../drizzle") });
});

afterEach(() => {
  sqlite.close();
});

function makeCaptureEvidence(overrides: Partial<CaptureEvidenceInput> = {}): CaptureEvidenceInput {
  return {
    id: "ce-1" as CaptureEvidenceId,
    userId: USER_ID,
    sourceFamily: "bancolombia",
    evidenceType: "last4",
    scope: "notification:bancolombia:last4",
    value: "1234",
    transactionId: "tx-1" as TransactionId,
    transferId: null,
    processedEmailId: null,
    processedCaptureId: "pc-1" as ProcessedCaptureId,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  };
}

function saveEvidence(overrides: Partial<CaptureEvidenceInput> = {}) {
  saveCaptureEvidence(db as any, makeCaptureEvidence(overrides));
}

function expectQueuedEvidence(...rowIds: string[]) {
  expect(getQueuedSyncEntries(db as any)).toEqual(
    rowIds.map((rowId) =>
      expect.objectContaining({
        tableName: "captureEvidence",
        rowId,
        operation: "insert",
      })
    )
  );
}

function seedRepeatedCaptureEvidence() {
  saveEvidence();
  saveEvidence({
    id: "ce-2" as CaptureEvidenceId,
    transactionId: null,
    processedCaptureId: "pc-2" as ProcessedCaptureId,
    createdAt: LATER,
    updatedAt: LATER,
  });
  saveEvidence({
    id: "ce-3" as CaptureEvidenceId,
    evidenceType: "sender_email",
    scope: "email:bancolombia:sender",
    value: "notificaciones@bancolombia.com.co",
    transactionId: "tx-3" as TransactionId,
    processedEmailId: "pe-1" as ProcessedEmailId,
    processedCaptureId: null,
  });
  saveEvidence({
    id: "ce-4" as CaptureEvidenceId,
    transactionId: null,
    processedCaptureId: "pc-4" as ProcessedCaptureId,
    deletedAt: "2026-04-19T12:00:00.000Z" as IsoDateTime,
  });
}

function expectRepeatedCaptureEvidenceCounts() {
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
  expectQueuedEvidence("ce-1", "ce-2", "ce-3", "ce-4");
}

describe("capture evidence repository", () => {
  it("saves evidence, enqueues sync, and counts repeated scoped evidence for one user", () => {
    seedRepeatedCaptureEvidence();
    expectRepeatedCaptureEvidenceCounts();
  });

  it("ignores stale relink-to-transfer updates", () => {
    saveEvidence({
      id: "ce-stale" as CaptureEvidenceId,
      processedCaptureId: "pc-stale" as ProcessedCaptureId,
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
      saveCaptureEvidence(
        db as any,
        makeCaptureEvidence({
          id: "ce-invalid" as CaptureEvidenceId,
          value: "9999",
          transferId: "tr-1" as TransferId,
          processedCaptureId: "pc-invalid" as ProcessedCaptureId,
        })
      )
    ).toThrow();
  });
});
