import { ensureDefaultFinancialAccount } from "@/features/financial-accounts/write.public";
import { recordAutomatedTransactionWithLocalLedger } from "@/infrastructure/local-ledger/record-transaction";
import {
  confirmReviewCandidateAsTransaction,
  type ReviewCandidateResolutionRecord,
} from "@/local-ledger/public";
import { getBuiltInCategoryId } from "@/shared/categories";
import type { AnyDb } from "@/shared/db";
import { toIsoDateTime } from "@/shared/lib/format-date";
import { generateTransactionId } from "@/shared/lib/generate-id";
import type {
  CopAmount,
  IsoDate,
  IsoDateTime,
  ProcessedSourceEventId,
  ReviewCandidateId,
  UserId,
} from "@/shared/types/branded";
import {
  acceptSourceEventFinancialMeaningReviewByIdInTransaction,
  dismissSourceEventFinancialMeaningReviewById,
  type FinancialMeaningSourceEventReviewRow,
  getFinancialMeaningSourceEventReviewRows,
  getSourceEventReviewCandidateById,
} from "./repository";

export type FinancialMeaningReviewItem = {
  readonly kind: "source_event";
  readonly processedSourceEvent: FinancialMeaningSourceEventReviewRow["processedSourceEvent"];
  readonly reviewCandidate: FinancialMeaningSourceEventReviewRow["reviewCandidate"];
};

export async function getFinancialMeaningReviewItems(db: AnyDb, userId: UserId) {
  const sourceEventRows = await getFinancialMeaningSourceEventReviewRows(db, userId);
  return sourceEventRows
    .map(
      (row): FinancialMeaningReviewItem => ({
        kind: "source_event",
        processedSourceEvent: row.processedSourceEvent,
        reviewCandidate: row.reviewCandidate,
      })
    )
    .sort((left, right) =>
      right.processedSourceEvent.receivedAt.localeCompare(left.processedSourceEvent.receivedAt)
    );
}

export async function confirmSourceEventFinancialMeaningReview(
  db: AnyDb,
  input: {
    readonly userId: UserId;
    readonly processedSourceEventId: ProcessedSourceEventId;
    readonly reviewCandidateId: ReviewCandidateId;
    readonly now?: () => IsoDateTime;
  }
) {
  const updatedAt = input.now?.() ?? toIsoDateTime(new Date());
  const transactionId = generateTransactionId();
  const defaultAccount = ensureDefaultFinancialAccount(db, input.userId, { now: updatedAt });
  const row = getSourceEventReviewCandidateById(db, {
    userId: input.userId,
    processedSourceEventId: input.processedSourceEventId,
    reviewCandidateId: input.reviewCandidateId,
  });
  if (!canConfirmSourceEventReview(row)) return false;

  const result = await confirmReviewCandidateAsTransaction(
    {
      userId: input.userId,
      processedSourceEventId: input.processedSourceEventId,
      candidateId: input.reviewCandidateId,
      now: updatedAt,
      command: buildSourceEventReviewTransactionCommand(input.userId, row, {
        accountId: defaultAccount.id,
        occurredOn: occurredOnFromRow(row),
      }),
    },
    {
      loadCandidate: async () => toReviewCandidateResolutionRecord(row),
      confirmTransaction: async ({ command }) => {
        const automatedCommand = toAutomatedReviewTransactionCommand(command);
        if (automatedCommand === null) {
          return {
            ok: false,
            code: "recording-rejected",
            reason: "review candidate transactions must use an automated source",
          };
        }

        const recorded = await recordAutomatedTransactionWithLocalLedger({
          db,
          command: automatedCommand,
          transactionId,
          now: updatedAt,
          afterRecord: (tx) => {
            const accepted = acceptSourceEventFinancialMeaningReviewByIdInTransaction(tx, {
              ...input,
              transactionId,
              updatedAt,
            });
            if (!accepted) throw new Error("Review candidate resolution target was not found");
          },
        }).catch((error: unknown) => ({
          success: false as const,
          error: error instanceof Error ? error.message : "Review candidate commit failed",
        }));

        return recorded.success
          ? { ok: true, recorded: { ok: true, transaction: recorded.transaction, events: [] } }
          : { ok: false, code: "recording-rejected", reason: recorded.error };
      },
    }
  );

  return result.ok;
}

function toAutomatedReviewTransactionCommand(
  command: Parameters<typeof confirmReviewCandidateAsTransaction>[0]["command"]
): Parameters<typeof recordAutomatedTransactionWithLocalLedger>[0]["command"] | null {
  return command.source === "manual"
    ? null
    : (command as Parameters<typeof recordAutomatedTransactionWithLocalLedger>[0]["command"]);
}

function canConfirmSourceEventReview(
  row: ReturnType<typeof getSourceEventReviewCandidateById>
): row is NonNullable<ReturnType<typeof getSourceEventReviewCandidateById>> {
  return row?.reviewCandidate.amount != null;
}

const getReviewCandidateTransactionType = (
  row: NonNullable<ReturnType<typeof getSourceEventReviewCandidateById>>
) => row.reviewCandidate.transactionType ?? "expense";

const getReviewCandidateCategoryId = (
  row: NonNullable<ReturnType<typeof getSourceEventReviewCandidateById>>
) => row.reviewCandidate.categoryId ?? getBuiltInCategoryId("other");

const getReviewCandidateCounterpartyName = (
  row: NonNullable<ReturnType<typeof getSourceEventReviewCandidateById>>
) => row.reviewCandidate.description ?? null;

const occurredOnFromRow = (
  row: NonNullable<ReturnType<typeof getSourceEventReviewCandidateById>>
): IsoDate =>
  (row.reviewCandidate.occurredAt ?? row.processedSourceEvent.receivedAt).slice(0, 10) as IsoDate;

function toReviewCandidateResolutionRecord(
  row: NonNullable<ReturnType<typeof getSourceEventReviewCandidateById>>
): ReviewCandidateResolutionRecord {
  return {
    id: row.reviewCandidate.id,
    userId: row.reviewCandidate.userId,
    processedSourceEventId: row.reviewCandidate.processedSourceEventId,
    status: row.reviewCandidate.status as ReviewCandidateResolutionRecord["status"],
    candidateKind: row.reviewCandidate
      .candidateKind as ReviewCandidateResolutionRecord["candidateKind"],
  };
}

function buildSourceEventReviewTransactionCommand(
  userId: UserId,
  row: NonNullable<ReturnType<typeof getSourceEventReviewCandidateById>>,
  input: {
    readonly accountId: Parameters<
      typeof recordAutomatedTransactionWithLocalLedger
    >[0]["command"]["accountId"];
    readonly occurredOn: IsoDate;
  }
): Parameters<typeof recordAutomatedTransactionWithLocalLedger>[0]["command"] {
  return {
    userId,
    type: getReviewCandidateTransactionType(row),
    amount: row.reviewCandidate.amount as CopAmount,
    categoryId: getReviewCandidateCategoryId(row),
    description: null,
    counterpartyName: getReviewCandidateCounterpartyName(row),
    occurredOn: input.occurredOn,
    accountId: input.accountId,
    accountAttributionState: "unresolved",
    source: "email_capture",
  };
}

export async function dismissSourceEventFinancialMeaningReview(
  db: AnyDb,
  userId: UserId,
  processedSourceEventId: ProcessedSourceEventId,
  reviewCandidateId: ReviewCandidateId,
  now: () => IsoDateTime = () => toIsoDateTime(new Date())
) {
  dismissSourceEventFinancialMeaningReviewById(db, {
    userId,
    processedSourceEventId,
    reviewCandidateId,
    updatedAt: now(),
  });
}
