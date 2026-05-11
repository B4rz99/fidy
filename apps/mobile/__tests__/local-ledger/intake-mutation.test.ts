import { getTableName } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import type { AnyDb } from "@/shared/db/client";
import {
  createReviewCandidateUseCase,
  type LocalLedgerCommandId,
  type LocalLedgerProcessedSourceEventId,
  type LocalLedgerReviewCandidateId,
  type LocalLedgerSourceId,
} from "@/local-ledger/public";
import {
  captureEvidence,
  processedSourceEvents,
  reviewCandidateCaptureEvidence,
  reviewCandidates,
} from "@/shared/db/schema";
import { createGenericWriteThroughMutationModule } from "@/shared/mutations";
import type { MutationCommand, MutationDb } from "@/shared/mutations/write-through";
import type {
  CopAmount,
  IsoDateTime,
  ProcessedSourceEventId,
  ReviewCandidateCaptureEvidenceId,
  ReviewCandidateId,
  UserId,
} from "@/shared/types/branded";
import { localLedgerHandlers } from "../../mutation-runtime/local-ledger-handlers";

const applyLocalLedgerCommand = (db: MutationDb, command: MutationCommand) =>
  localLedgerHandlers["localLedger.reviewCandidate.create"](db, command as never);

const NOW = "2026-04-12T10:00:00.000Z" as IsoDateTime;

type CreateReviewCandidateMutationCommand = Extract<
  MutationCommand,
  { kind: "localLedger.reviewCandidate.create" }
>;

const makeProcessedSourceEventRow = () => ({
  id: "pse-1" as ProcessedSourceEventId,
  userId: "user-1" as UserId,
  sourceFamily: "email",
  sourceId: "gmail-primary",
  sourceEventId: "gmail-message-1",
  status: "needs_review",
  failureReason: null,
  receivedAt: "2026-04-12T09:00:00.000Z" as IsoDateTime,
  processedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
});

const makeReviewCandidateRow = () => ({
  id: "rc-1" as ReviewCandidateId,
  userId: "user-1" as UserId,
  processedSourceEventId: "pse-1" as ProcessedSourceEventId,
  status: "pending",
  candidateKind: "transaction",
  occurredAt: "2026-04-12T09:00:00.000Z" as IsoDateTime,
  amount: 12500 as CopAmount,
  currency: "COP",
  description: "Low confidence cafe capture",
  confidence: 0.42,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
});

const makeEvidenceRow = () => ({
  id: "ce-1" as never,
  userId: "user-1" as UserId,
  sourceFamily: "email",
  evidenceType: "counterparty_hint",
  scope: "merchant",
  value: "Cafe",
  transactionId: null,
  transferId: null,
  processedEmailId: null,
  processedCaptureId: null,
  processedSourceEventId: "pse-1" as ProcessedSourceEventId,
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
});

const makeEvidenceLinkRow = () => ({
  id: "rcce-1" as ReviewCandidateCaptureEvidenceId,
  userId: "user-1" as UserId,
  reviewCandidateId: "rc-1" as ReviewCandidateId,
  captureEvidenceId: "ce-1" as never,
  createdAt: NOW,
  deletedAt: null,
});

function makeCreateReviewCandidateCommand(
  overrides: Partial<CreateReviewCandidateMutationCommand> = {}
): CreateReviewCandidateMutationCommand {
  return {
    kind: "localLedger.reviewCandidate.create",
    processedSourceEventRow: makeProcessedSourceEventRow(),
    reviewCandidateRow: makeReviewCandidateRow(),
    evidenceRows: [makeEvidenceRow()],
    evidenceLinkRows: [makeEvidenceLinkRow()],
    ...overrides,
  };
}

const makeCreateReviewCandidateInput = () =>
  ({
    commandId: "cmd-1" as LocalLedgerCommandId,
    userId: "user-1",
    source: {
      processedSourceEventId: "pse-1" as LocalLedgerProcessedSourceEventId,
      sourceFamily: "email",
      sourceId: "gmail-primary" as LocalLedgerSourceId,
      sourceEventId: "gmail-message-1",
      receivedAt: "2026-04-12T09:00:00.000Z",
      processedAt: "2026-04-12T10:00:00.000Z",
      status: "needs_review",
      failureReason: null,
    },
    candidate: {
      id: "rc-1" as LocalLedgerReviewCandidateId,
      candidateKind: "transaction",
      status: "pending",
      occurredAt: "2026-04-12T09:00:00.000Z",
      money: { amount: 12500 as CopAmount, currency: "COP" },
      description: "Low confidence cafe capture",
      confidence: 0.42,
    },
    evidence: [
      {
        id: "ce-1",
        linkId: "rcce-1",
        sourceFamily: "email",
        evidenceType: "counterparty_hint",
        scope: "merchant",
        value: "Cafe",
      },
    ],
    now: "2026-04-12T10:00:00.000Z",
  }) as const;

describe("local ledger intake mutations", () => {
  it("maps the exported CreateReviewCandidate use case to the write-through commit command", async () => {
    const commit = vi.fn<(...args: any[]) => any>().mockResolvedValue({
      success: true,
      didMutate: true,
    });
    const createReviewCandidate = createReviewCandidateUseCase({ commit });

    await expect(createReviewCandidate(makeCreateReviewCandidateInput())).resolves.toEqual({
      success: true,
    });

    expect(commit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "localLedger.reviewCandidate.create",
        processedSourceEventRow: expect.objectContaining({
          id: "pse-1",
          status: "needs_review",
        }),
        reviewCandidateRow: expect.objectContaining({
          id: "rc-1",
          processedSourceEventId: "pse-1",
          status: "pending",
          amount: 12500,
        }),
        evidenceRows: [
          expect.objectContaining({
            id: "ce-1",
            transactionId: null,
            transferId: null,
            processedEmailId: null,
            processedCaptureId: null,
            processedSourceEventId: "pse-1",
          }),
        ],
        evidenceLinkRows: [
          expect.objectContaining({
            id: "rcce-1",
            userId: "user-1",
            reviewCandidateId: "rc-1",
            captureEvidenceId: "ce-1",
          }),
        ],
      })
    );
  });

  it("atomically persists needs-review intake without committed transaction records", async () => {
    const inserted: { table: string; row: unknown }[] = [];
    const db = {
      transaction: vi.fn<(...args: any[]) => any>((fn: (tx: AnyDb) => unknown) => fn(db as AnyDb)),
      insert: vi.fn<(...args: any[]) => any>((table) => ({
        values: vi.fn<(...args: any[]) => any>((row) => {
          inserted.push({ table: getTableName(table), row });
          return { run: vi.fn<(...args: any[]) => any>() };
        }),
      })),
    } as unknown as AnyDb;
    const module = createGenericWriteThroughMutationModule(db, applyLocalLedgerCommand);

    const result = await module.commit(makeCreateReviewCandidateCommand());

    expect(result).toEqual({ success: true, didMutate: true });
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(inserted.map((entry) => entry.table)).toEqual([
      getTableName(processedSourceEvents),
      getTableName(reviewCandidates),
      getTableName(captureEvidence),
      getTableName(reviewCandidateCaptureEvidence),
    ]);
  });

  it("rolls back source event, candidate, evidence, and links when a later intake insert fails", async () => {
    const committed: { table: string; row: unknown }[] = [];
    let staged: { table: string; row: unknown }[] | null = null;
    const db = {
      transaction: vi.fn<(...args: any[]) => any>((fn: (tx: AnyDb) => unknown) => {
        const transactionStaging: { table: string; row: unknown }[] = [];
        staged = transactionStaging;
        try {
          const result = fn(db as AnyDb);
          committed.push(...transactionStaging);
          return result;
        } finally {
          staged = null;
        }
      }),
      insert: vi.fn<(...args: any[]) => any>((table) => ({
        values: vi.fn<(...args: any[]) => any>((row) => ({
          run: vi.fn<(...args: any[]) => any>(() => {
            const tableName = getTableName(table);
            if (
              tableName === getTableName(reviewCandidateCaptureEvidence) &&
              staged?.some((entry) => entry.table === tableName)
            ) {
              throw new Error("UNIQUE constraint failed");
            }
            staged?.push({ table: tableName, row });
          }),
        })),
      })),
    } as unknown as AnyDb;
    const module = createGenericWriteThroughMutationModule(db as never, applyLocalLedgerCommand);

    const duplicateLink = {
      id: "rcce-2" as ReviewCandidateCaptureEvidenceId,
      userId: "user-1" as UserId,
      reviewCandidateId: "rc-1" as ReviewCandidateId,
      captureEvidenceId: "ce-1" as never,
      createdAt: NOW,
      deletedAt: null,
    };
    const command = makeCreateReviewCandidateCommand({
      evidenceLinkRows: [makeCreateReviewCandidateCommand().evidenceLinkRows[0]!, duplicateLink],
    });

    const result = await module.commit(command);

    expect(result).toEqual({
      success: false,
      error: expect.stringContaining("UNIQUE constraint failed"),
    });
    expect(committed).toEqual([]);
  });
});
