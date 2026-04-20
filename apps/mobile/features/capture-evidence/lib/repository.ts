import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import type { AnyDb } from "@/shared/db/client";
import { enqueueSync } from "@/shared/db/enqueue-sync";
import { captureEvidence } from "@/shared/db/schema";
import { generateCaptureEvidenceId, generateSyncQueueId } from "@/shared/lib/generate-id";
import type { CaptureEvidenceSeed } from "../schema";

export type CaptureEvidenceRow = typeof captureEvidence.$inferInsert;
type CaptureEvidenceLink = Pick<
  CaptureEvidenceRow,
  | "processedEmailId"
  | "processedCaptureId"
  | "transactionId"
  | "transferId"
  | "userId"
  | "createdAt"
  | "updatedAt"
>;

type RepeatedCaptureEvidenceRow = {
  readonly scope: string;
  readonly value: string;
  readonly sourceFamily: string;
  readonly evidenceType: string;
  readonly occurrences: number;
};

function saveCaptureEvidenceInTransaction(db: AnyDb, row: CaptureEvidenceRow) {
  const existing = getCaptureEvidenceById(db, row.id);

  persistCaptureEvidence(db, row);

  enqueueSync(db, {
    id: generateSyncQueueId(),
    tableName: "captureEvidence",
    rowId: row.id,
    operation: existing ? "update" : "insert",
    createdAt: row.updatedAt,
  });
}

function persistCaptureEvidence(db: AnyDb, row: CaptureEvidenceRow) {
  db.insert(captureEvidence)
    .values(row)
    .onConflictDoUpdate({
      target: captureEvidence.id,
      set: {
        userId: row.userId,
        sourceFamily: row.sourceFamily,
        evidenceType: row.evidenceType,
        scope: row.scope,
        value: row.value,
        transactionId: row.transactionId,
        transferId: row.transferId ?? null,
        processedEmailId: row.processedEmailId,
        processedCaptureId: row.processedCaptureId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
      },
    })
    .run();
}

export function getCaptureEvidenceById(db: AnyDb, id: CaptureEvidenceRow["id"]) {
  const rows = db.select().from(captureEvidence).where(eq(captureEvidence.id, id)).all();
  return rows[0] ?? null;
}

export function upsertCaptureEvidence(db: AnyDb, row: CaptureEvidenceRow) {
  const existing = getCaptureEvidenceById(db, row.id);
  if (existing && existing.updatedAt >= row.updatedAt) {
    return;
  }

  persistCaptureEvidence(db, row);
}

export function saveCaptureEvidence(db: AnyDb, row: CaptureEvidenceRow) {
  db.transaction((tx) => saveCaptureEvidenceInTransaction(tx, row));
}

export function saveCaptureEvidenceRows(db: AnyDb, rows: readonly CaptureEvidenceRow[]) {
  if (rows.length === 0) {
    return;
  }

  db.transaction((tx) => {
    rows.forEach((row) => {
      saveCaptureEvidenceInTransaction(tx, row);
    });
  });
}

export function materializeCaptureEvidenceRows(
  evidence: readonly CaptureEvidenceSeed[],
  link: CaptureEvidenceLink
): readonly CaptureEvidenceRow[] {
  return evidence.map((row) => ({
    id: generateCaptureEvidenceId(),
    userId: link.userId,
    sourceFamily: row.sourceFamily,
    evidenceType: row.evidenceType,
    scope: row.scope,
    value: row.value,
    transactionId: link.transactionId ?? null,
    transferId: link.transferId ?? null,
    processedEmailId: link.processedEmailId,
    processedCaptureId: link.processedCaptureId,
    createdAt: link.createdAt,
    updatedAt: link.updatedAt,
    deletedAt: null,
  }));
}

export function linkCaptureEvidenceToTransaction(
  db: AnyDb,
  processedEmailId: NonNullable<CaptureEvidenceRow["processedEmailId"]>,
  transactionId: NonNullable<CaptureEvidenceRow["transactionId"]>,
  updatedAt: CaptureEvidenceRow["updatedAt"]
) {
  const rows = db
    .select()
    .from(captureEvidence)
    .where(
      and(eq(captureEvidence.processedEmailId, processedEmailId), isNull(captureEvidence.deletedAt))
    )
    .all();

  if (rows.length === 0) {
    return;
  }

  db.transaction((tx) => {
    rows.forEach((row) => {
      if (row.transactionId === transactionId && row.updatedAt >= updatedAt) {
        return;
      }

      saveCaptureEvidenceInTransaction(tx, {
        ...row,
        transactionId,
        transferId: null,
        updatedAt,
      });
    });
  });
}

export function relinkCaptureEvidenceToTransfer(
  db: AnyDb,
  transactionId: NonNullable<CaptureEvidenceRow["transactionId"]>,
  transferId: NonNullable<CaptureEvidenceRow["transferId"]>,
  updatedAt: CaptureEvidenceRow["updatedAt"]
) {
  const rows = db
    .select()
    .from(captureEvidence)
    .where(and(eq(captureEvidence.transactionId, transactionId), isNull(captureEvidence.deletedAt)))
    .all();

  if (rows.length === 0) {
    return;
  }

  db.transaction((tx) => {
    rows.forEach((row) => {
      if (
        row.transactionId === null &&
        row.transferId === transferId &&
        row.updatedAt >= updatedAt
      ) {
        return;
      }

      saveCaptureEvidenceInTransaction(tx, {
        ...row,
        transactionId: null,
        transferId,
        updatedAt,
      });
    });
  });
}

export function countCaptureEvidenceOccurrences(
  db: AnyDb,
  userId: CaptureEvidenceRow["userId"],
  scope: CaptureEvidenceRow["scope"],
  value: CaptureEvidenceRow["value"]
) {
  const rows = db
    .select({ total: count() })
    .from(captureEvidence)
    .where(
      and(
        eq(captureEvidence.userId, userId),
        eq(captureEvidence.scope, scope),
        eq(captureEvidence.value, value),
        isNull(captureEvidence.deletedAt)
      )
    )
    .all();

  return rows[0]?.total ?? 0;
}

export function getCaptureEvidenceRowsForScopeValue(
  db: AnyDb,
  userId: CaptureEvidenceRow["userId"],
  scope: CaptureEvidenceRow["scope"],
  value: CaptureEvidenceRow["value"]
) {
  return db
    .select()
    .from(captureEvidence)
    .where(
      and(
        eq(captureEvidence.userId, userId),
        eq(captureEvidence.scope, scope),
        eq(captureEvidence.value, value),
        isNull(captureEvidence.deletedAt)
      )
    )
    .orderBy(desc(captureEvidence.updatedAt), captureEvidence.id)
    .all();
}

export function getCaptureEvidenceRowsForTransaction(
  db: AnyDb,
  userId: CaptureEvidenceRow["userId"],
  transactionId: NonNullable<CaptureEvidenceRow["transactionId"]>
) {
  return db
    .select()
    .from(captureEvidence)
    .where(
      and(
        eq(captureEvidence.userId, userId),
        eq(captureEvidence.transactionId, transactionId),
        isNull(captureEvidence.deletedAt)
      )
    )
    .orderBy(desc(captureEvidence.updatedAt), captureEvidence.id)
    .all();
}

export function getRepeatedCaptureEvidenceForUser(
  db: AnyDb,
  userId: CaptureEvidenceRow["userId"],
  minimumOccurrences = 2
): readonly RepeatedCaptureEvidenceRow[] {
  const occurrences = sql<number>`count(*)`;

  return db
    .select({
      scope: captureEvidence.scope,
      value: captureEvidence.value,
      sourceFamily: captureEvidence.sourceFamily,
      evidenceType: captureEvidence.evidenceType,
      occurrences,
    })
    .from(captureEvidence)
    .where(and(eq(captureEvidence.userId, userId), isNull(captureEvidence.deletedAt)))
    .groupBy(
      captureEvidence.scope,
      captureEvidence.value,
      captureEvidence.sourceFamily,
      captureEvidence.evidenceType
    )
    .having(sql`${occurrences} >= ${minimumOccurrences}`)
    .orderBy(desc(occurrences), captureEvidence.scope, captureEvidence.value)
    .all();
}
