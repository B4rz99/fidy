import type { CaptureEvidenceType } from "@/shared/capture-evidence/types";
import type {
  CaptureEvidenceId,
  CopAmount,
  CategoryId,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  ProcessedSourceEventId,
  ReviewCandidateId,
  ReviewCandidateCaptureEvidenceId,
  TransferId,
  UserId,
} from "@/shared/types/branded";
import type { TransferSource } from "@/shared/types/ledger-source";

export type { FinancialAccountId, TransferSource, TransferId, UserId };

export type LocalLedgerCommandId = string & { readonly __brand: "LocalLedgerCommandId" };

export type LocalLedgerEntryId = string & { readonly __brand: "LocalLedgerEntryId" };

export type LocalLedgerSourceId = string & { readonly __brand: "LocalLedgerSourceId" };

export type LocalLedgerProcessedSourceEventId = ProcessedSourceEventId;

export type LocalLedgerReviewCandidateId = ReviewCandidateId;

export type LocalLedgerMoney = {
  readonly amount: CopAmount;
  readonly currency: "COP";
};

export type LocalLedgerEntry = {
  readonly id: LocalLedgerEntryId;
  readonly occurredAt: string;
  readonly money: LocalLedgerMoney;
  readonly description: string;
  readonly sourceId: LocalLedgerSourceId | null;
};

export type LocalLedgerTransferSide =
  | {
      readonly kind: "account";
      readonly accountId: FinancialAccountId;
    }
  | {
      readonly kind: "external";
      readonly label: string;
    };

export type LocalLedgerTransfer = {
  readonly id: TransferId;
  readonly userId: UserId;
  readonly amount: CopAmount;
  readonly fromSide: LocalLedgerTransferSide;
  readonly toSide: LocalLedgerTransferSide;
  readonly description: string;
  readonly date: IsoDate;
  readonly source: TransferSource;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly voidedAt: IsoDateTime | null;
};

export type LocalLedgerTransferRecorded = {
  readonly type: "local-ledger.transfer-recorded";
  readonly transferId: TransferId;
  readonly userId: UserId;
  readonly occurredAt: IsoDateTime;
};

export type LocalLedgerDomainEvent = LocalLedgerTransferRecorded;

export type LocalLedgerCaptureEvidence = {
  readonly id: CaptureEvidenceId;
  readonly linkId: ReviewCandidateCaptureEvidenceId;
  readonly sourceFamily: string;
  readonly evidenceType: CaptureEvidenceType;
  readonly scope: string;
  readonly value: string;
};

export type LocalLedgerProcessedSourceEventStatus =
  | "processed"
  | "needs_review"
  | "failed"
  | "duplicate"
  | "dismissed";

export type LocalLedgerReviewCandidateStatus = "pending" | "accepted" | "rejected";

export type LocalLedgerReviewCandidate = {
  readonly id: LocalLedgerReviewCandidateId;
  readonly candidateKind: "unknown" | "transaction" | "transfer";
  readonly status: LocalLedgerReviewCandidateStatus;
  readonly occurredAt: IsoDateTime | null;
  readonly money: LocalLedgerMoney | null;
  readonly transactionType?: "expense" | "income" | null;
  readonly categoryId?: CategoryId | null;
  readonly description: string | null;
  readonly confidence: number | null;
};
