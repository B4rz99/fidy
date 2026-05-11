import type { LocalLedgerCommandId, LocalLedgerSourceId } from "../domain/public";

export type IntakeLocalLedgerCandidate = {
  readonly commandId: LocalLedgerCommandId;
  readonly sourceId: LocalLedgerSourceId;
  readonly receivedAt: string;
  readonly rawText: string;
};

export type IntakeLocalLedgerCandidateResult = {
  readonly accepted: boolean;
  readonly reason: string | null;
};

export type IntakeLocalLedgerCandidateHandler = (
  candidate: IntakeLocalLedgerCandidate
) => Promise<IntakeLocalLedgerCandidateResult>;
