// biome-ignore-all lint/suspicious/noExplicitAny: integration test uses a real SQLite DB
import { resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  countCaptureEvidenceOccurrences,
  getCaptureEvidenceById,
  getCaptureEvidenceRowsForScopeValue,
  getRepeatedCaptureEvidenceForUser,
  linkCaptureEvidenceToTransaction,
  relinkCaptureEvidenceToTransfer,
  saveCaptureEvidence,
  saveCaptureEvidenceRows,
  upsertCaptureEvidence,
} from "@/features/capture-evidence";
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
    id: "ce-deleted" as CaptureEvidenceId,
    transactionId: null,
    processedCaptureId: "pc-deleted" as ProcessedCaptureId,
    deletedAt: LATER,
  });
  saveEvidence({
    id: "ce-email" as CaptureEvidenceId,
    evidenceType: "sender_email",
    scope: "email:bancolombia:sender",
    value: "notificaciones@bancolombia.com.co",
    processedEmailId: "pe-1" as ProcessedEmailId,
    processedCaptureId: null,
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
}

function seedEmailEvidenceForLinking() {
  saveCaptureEvidenceRows(db as any, [
    makeCaptureEvidence({
      id: "ce-email-1" as CaptureEvidenceId,
      transactionId: null,
      processedEmailId: "pe-link" as ProcessedEmailId,
      processedCaptureId: null,
    }),
    makeCaptureEvidence({
      id: "ce-email-2" as CaptureEvidenceId,
      evidenceType: "sender_email",
      scope: "email:bancolombia:sender",
      value: "notificaciones@bancolombia.com.co",
      transactionId: "tx-linked" as TransactionId,
      processedEmailId: "pe-link" as ProcessedEmailId,
      processedCaptureId: null,
      updatedAt: LATER,
    }),
  ]);
}

function expectEmailEvidenceLinkingResult() {
  expect(getCaptureEvidenceById(db as any, "ce-email-1" as CaptureEvidenceId)).toEqual(
    expect.objectContaining({
      transactionId: "tx-linked",
      updatedAt: "2026-04-19T10:30:00.000Z",
    })
  );
  expect(getCaptureEvidenceById(db as any, "ce-email-2" as CaptureEvidenceId)).toEqual(
    expect.objectContaining({ updatedAt: LATER })
  );
}

describe("capture evidence repository", () => {
  it("counts repeated active evidence and ignores deleted rows", () => {
    seedRepeatedCaptureEvidence();

    expectRepeatedCaptureEvidenceCounts();
    expect(
      getCaptureEvidenceRowsForScopeValue(db as any, {
        userId: USER_ID,
        scope: "notification:bancolombia:last4",
        value: "1234",
      })
    ).toHaveLength(2);
  });

  it("upserts only fresher evidence rows", () => {
    saveEvidence();

    upsertCaptureEvidence(
      db as any,
      makeCaptureEvidence({
        value: "stale",
        updatedAt: "2026-04-19T09:00:00.000Z" as IsoDateTime,
      })
    );
    expect(getCaptureEvidenceById(db as any, "ce-1" as CaptureEvidenceId)).toEqual(
      expect.objectContaining({ value: "1234", updatedAt: NOW })
    );

    upsertCaptureEvidence(
      db as any,
      makeCaptureEvidence({
        value: "fresh",
        updatedAt: LATER,
      })
    );
    expect(getCaptureEvidenceById(db as any, "ce-1" as CaptureEvidenceId)).toEqual(
      expect.objectContaining({ value: "fresh", updatedAt: LATER })
    );
  });

  it("links email evidence to a transaction when the link is fresher", () => {
    seedEmailEvidenceForLinking();

    linkCaptureEvidenceToTransaction(db as any, {
      processedEmailId: "pe-link" as ProcessedEmailId,
      transactionId: "tx-linked" as TransactionId,
      updatedAt: "2026-04-19T10:30:00.000Z" as IsoDateTime,
    });

    expectEmailEvidenceLinkingResult();
  });

  it("does nothing for empty batch saves and missing relink targets", () => {
    saveCaptureEvidenceRows(db as any, []);
    linkCaptureEvidenceToTransaction(db as any, {
      processedEmailId: "pe-missing" as ProcessedEmailId,
      transactionId: "tx-missing" as TransactionId,
      updatedAt: LATER,
    });
    relinkCaptureEvidenceToTransfer(db as any, {
      transactionId: "tx-missing" as TransactionId,
      transferId: "tr-missing" as TransferId,
      updatedAt: LATER,
    });

    expect(getRepeatedCaptureEvidenceForUser(db as any, USER_ID)).toEqual([]);
  });

  it("ignores stale relink-to-transfer updates", () => {
    saveEvidence({
      id: "ce-stale" as CaptureEvidenceId,
      processedCaptureId: "pc-stale" as ProcessedCaptureId,
    });

    relinkCaptureEvidenceToTransfer(db as any, {
      transactionId: "tx-1" as TransactionId,
      transferId: "tr-1" as TransferId,
      updatedAt: "2026-04-19T09:00:00.000Z" as IsoDateTime,
    });

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
