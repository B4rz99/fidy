import { readFinancialAccountKind } from "@/features/financial-accounts/lib/kind";
import type { FinancialAccountRow } from "@/features/financial-accounts/public";
import type { TransferSide } from "@/features/transfers/lib/build-transfer";
import type { TransferMutationError } from "@/features/transfers/lib/mutation-service";
import type { ReclassifyTransactionAsTransferError } from "@/features/transfers/lib/reclassify-transaction-as-transfer";
import type { LucideIcon } from "@/shared/components/icons";
import { CreditCard, Landmark, PiggyBank, Wallet } from "@/shared/components/icons";

type TransferFormPresentationInput = {
  readonly amount: number;
  readonly fromSide: TransferSide | null;
  readonly isReclassification: boolean;
  readonly toSide: TransferSide | null;
};

export type TransferFormPresentationState = {
  readonly bothExternal: boolean;
  readonly buttonLabelKey: string;
  readonly canSave: boolean;
  readonly hasOutsideSide: boolean;
  readonly hintKey: string;
  readonly sameAccountConflict: boolean;
  readonly subtitleKey: string;
};

type TransferFormFlags = Pick<
  TransferFormPresentationState,
  "bothExternal" | "canSave" | "hasOutsideSide" | "sameAccountConflict"
>;

type TransferFormCopy = Pick<
  TransferFormPresentationState,
  "buttonLabelKey" | "hintKey" | "subtitleKey"
>;

const TRANSFER_ERROR_MESSAGE_KEYS = {
  accountNotUsable: "transfers.errors.saveFailed",
  amountRequired: "transfers.errors.amountRequired",
  amountNotPositive: "transfers.errors.amountRequired",
  distinctSidesRequired: "transfers.errors.distinctSidesRequired",
  externalLabelRequired: "transfers.errors.saveFailed",
  futureDated: "transfers.errors.saveFailed",
  reviewCandidateRequired: "transfers.errors.reclassifyFailed",
  saveFailed: "transfers.errors.saveFailed",
  storeNotInitialized: "transfers.errors.saveFailed",
  trackedAccountRequired: "transfers.errors.trackedAccountRequired",
  transactionNotFound: "transfers.errors.reclassifyFailed",
} as const;

function hasSameAccountConflict(fromSide: TransferSide | null, toSide: TransferSide | null) {
  return (
    fromSide?.kind === "account" &&
    toSide?.kind === "account" &&
    fromSide.accountId === toSide.accountId
  );
}

function hasBothExternalSides(fromSide: TransferSide | null, toSide: TransferSide | null) {
  return fromSide?.kind === "external" && toSide?.kind === "external";
}

function hasOutsideTransferSide(fromSide: TransferSide | null, toSide: TransferSide | null) {
  return fromSide?.kind === "external" || toSide?.kind === "external";
}

function canSaveTransferForm(input: {
  readonly amount: number;
  readonly bothExternal: boolean;
  readonly fromSide: TransferSide | null;
  readonly sameAccountConflict: boolean;
  readonly toSide: TransferSide | null;
}) {
  return (
    input.amount > 0 &&
    input.fromSide != null &&
    input.toSide != null &&
    !input.sameAccountConflict &&
    !input.bothExternal
  );
}

function buildTransferFormState(input: {
  readonly bothExternal: boolean;
  readonly buttonLabelKey: string;
  readonly canSave: boolean;
  readonly hasOutsideSide: boolean;
  readonly hintKey: string;
  readonly sameAccountConflict: boolean;
  readonly subtitleKey: string;
}): TransferFormPresentationState {
  return {
    bothExternal: input.bothExternal,
    buttonLabelKey: input.buttonLabelKey,
    canSave: input.canSave,
    hasOutsideSide: input.hasOutsideSide,
    hintKey: input.hintKey,
    sameAccountConflict: input.sameAccountConflict,
    subtitleKey: input.subtitleKey,
  };
}

function getTransferFormFlags(input: TransferFormPresentationInput): TransferFormFlags {
  const sameAccountConflict = hasSameAccountConflict(input.fromSide, input.toSide);
  const bothExternal = hasBothExternalSides(input.fromSide, input.toSide);

  return {
    bothExternal,
    canSave: canSaveTransferForm({
      amount: input.amount,
      bothExternal,
      fromSide: input.fromSide,
      sameAccountConflict,
      toSide: input.toSide,
    }),
    hasOutsideSide: hasOutsideTransferSide(input.fromSide, input.toSide),
    sameAccountConflict,
  };
}

function getSaveButtonLabelKey(isReclassification: boolean) {
  return isReclassification ? "transfers.reclassifySave" : "transfers.save";
}

function getTransferFormCopy(
  input: TransferFormPresentationInput,
  flags: TransferFormFlags
): TransferFormCopy {
  if (flags.sameAccountConflict) {
    return {
      buttonLabelKey: "transfers.chooseDifferentSide",
      hintKey: "transfers.conflictHint",
      subtitleKey: "transfers.conflictSubtitle",
    };
  }

  if (input.isReclassification && !flags.bothExternal) {
    return {
      buttonLabelKey: "transfers.reclassifySave",
      hintKey: "transfers.reclassifyHint",
      subtitleKey: "transfers.reclassifySubtitle",
    };
  }

  if (flags.bothExternal) {
    return {
      buttonLabelKey: getSaveButtonLabelKey(input.isReclassification),
      hintKey: "transfers.errors.trackedAccountRequired",
      subtitleKey: "transfers.outsideSubtitle",
    };
  }

  return {
    buttonLabelKey: getSaveButtonLabelKey(input.isReclassification),
    hintKey: flags.hasOutsideSide ? "transfers.outsideSelectedHint" : "transfers.outsideHint",
    subtitleKey: flags.hasOutsideSide ? "transfers.outsideSubtitle" : "transfers.subtitle",
  };
}

export function getKindIcon(kind: FinancialAccountRow["kind"]): LucideIcon {
  const resolvedKind = readFinancialAccountKind(kind);

  if (resolvedKind === "credit_card") return CreditCard;
  if (resolvedKind === "wallet" || resolvedKind === "cash") return Wallet;
  if (resolvedKind === "savings") return PiggyBank;
  return Landmark;
}

export function getTransferErrorMessageKey(
  error: TransferMutationError | ReclassifyTransactionAsTransferError | "saveFailed"
) {
  return error === "fromSideRequired" || error === "toSideRequired"
    ? "transfers.errors.sidesRequired"
    : TRANSFER_ERROR_MESSAGE_KEYS[error];
}

export function getTransferFormPresentationState(
  input: TransferFormPresentationInput
): TransferFormPresentationState {
  const flags = getTransferFormFlags(input);
  const copy = getTransferFormCopy(input, flags);

  return buildTransferFormState({ ...flags, ...copy });
}
