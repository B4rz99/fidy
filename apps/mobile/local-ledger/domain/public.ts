import type { CaptureEvidenceType } from "@/features/capture-evidence/schema.public";
import type {
  CopAmount,
  FinancialAccountId,
  IsoDate,
  IsoDateTime,
  TransferId,
  UserId,
} from "@/shared/types/branded";

export type { FinancialAccountId, TransferId, UserId };

export type LocalLedgerCommandId = string & { readonly __brand: "LocalLedgerCommandId" };

export type LocalLedgerEntryId = string & { readonly __brand: "LocalLedgerEntryId" };

export type LocalLedgerSourceId = string & { readonly __brand: "LocalLedgerSourceId" };

export type LocalLedgerProcessedSourceEventId = string & {
  readonly __brand: "LocalLedgerProcessedSourceEventId";
};

export type LocalLedgerReviewCandidateId = string & {
  readonly __brand: "LocalLedgerReviewCandidateId";
};

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
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
  readonly deletedAt: IsoDateTime | null;
};

export type LocalLedgerTransferRecorded = {
  readonly type: "local-ledger.transfer-recorded";
  readonly transferId: TransferId;
  readonly userId: UserId;
  readonly occurredAt: IsoDateTime;
};

export type LocalLedgerDomainEvent = LocalLedgerTransferRecorded;

export type LocalLedgerCaptureEvidence = {
  readonly id: string;
  readonly linkId: string;
  readonly sourceFamily: string;
  readonly evidenceType: CaptureEvidenceType;
  readonly scope: string;
  readonly value: string;
};

export type LocalLedgerProcessedSourceEventStatus = "processed" | "needs_review" | "failed";

export type LocalLedgerReviewCandidateStatus = "pending" | "accepted" | "rejected";

export type LocalLedgerReviewCandidate = {
  readonly id: LocalLedgerReviewCandidateId;
  readonly candidateKind: "transaction" | "transfer";
  readonly status: LocalLedgerReviewCandidateStatus;
  readonly occurredAt: string | null;
  readonly money: LocalLedgerMoney | null;
  readonly description: string | null;
  readonly confidence: number | null;
};
