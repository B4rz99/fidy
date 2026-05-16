import { parseDigitsToAmount } from "@/shared/lib/format-money";
import type { CopAmount, FinancialAccountId } from "@/shared/types/branded";
import type {
  BuildTransferCommand,
  StoredTransfer,
  TransferBuildError,
  TransferSide,
} from "./build-transfer";

export type TransferSideValidationResult =
  | { success: true; fromSide: TransferSide; toSide: TransferSide }
  | { success: false; error: TransferBuildError };

function normalizeExternalLabel(label: string): string {
  const trimmed = label.trim();
  return trimmed.length > 0 ? trimmed : "Outside Fidy";
}

function trimLabel(side: TransferSide): TransferSide {
  if (side.kind === "account") {
    return side;
  }
  return { kind: "external", label: normalizeExternalLabel(side.label) };
}

function isAccountSide(side: TransferSide): side is Extract<TransferSide, { kind: "account" }> {
  return side.kind === "account";
}

function hasTrackedTransferSide(fromSide: TransferSide, toSide: TransferSide): boolean {
  return isAccountSide(fromSide) || isAccountSide(toSide);
}

function hasDuplicateTrackedTransferSide(fromSide: TransferSide, toSide: TransferSide): boolean {
  return (
    isAccountSide(fromSide) && isAccountSide(toSide) && fromSide.accountId === toSide.accountId
  );
}

export function buildTransferAmount(digits: string): CopAmount | null {
  const amount = parseDigitsToAmount(digits);
  return amount > 0 ? (amount as CopAmount) : null;
}

export function validateTransferSides(
  fromSide: TransferSide | null,
  toSide: TransferSide | null
): TransferSideValidationResult {
  if (fromSide == null) {
    return { success: false, error: "fromSideRequired" };
  }
  if (toSide == null) {
    return { success: false, error: "toSideRequired" };
  }

  const normalizedFromSide = trimLabel(fromSide);
  const normalizedToSide = trimLabel(toSide);
  if (!hasTrackedTransferSide(normalizedFromSide, normalizedToSide)) {
    return { success: false, error: "trackedAccountRequired" };
  }
  if (hasDuplicateTrackedTransferSide(normalizedFromSide, normalizedToSide)) {
    return { success: false, error: "distinctSidesRequired" };
  }

  return {
    success: true,
    fromSide: normalizedFromSide,
    toSide: normalizedToSide,
  };
}

export function toStoredTransferSide(
  accountId: FinancialAccountId | null,
  externalLabel: string | null
): TransferSide {
  if (accountId != null) {
    return { kind: "account", accountId };
  }
  return { kind: "external", label: externalLabel ?? "Outside Fidy" };
}

export function toTransferAccountId(side: TransferSide): FinancialAccountId | null {
  return side.kind === "account" ? side.accountId : null;
}

export function toTransferExternalLabel(side: TransferSide): string | null {
  return side.kind === "external" ? side.label : null;
}

export function buildStoredTransfer(
  command: BuildTransferCommand,
  amount: CopAmount,
  sides: { readonly fromSide: TransferSide; readonly toSide: TransferSide }
): StoredTransfer {
  const { input: formInput, userId, id, now, existing = null } = command;
  return {
    id,
    userId,
    amount,
    fromSide: sides.fromSide,
    toSide: sides.toSide,
    description: formInput.description.trim(),
    date: formInput.date,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    deletedAt: existing?.deletedAt ?? null,
    source: command.source,
  };
}
