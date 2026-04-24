import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { getFinancialAccountBalancesForUser } from "@/features/financial-accounts/lib/balance-repository";
import {
  type FinancialAccountRow,
  getFinancialAccountsForUser,
} from "@/features/financial-accounts/public";
import type { StoredTransaction } from "@/features/transactions/query.public";
import { OUTSIDE_FIDY_LABEL, type TransferSide } from "@/features/transfers/lib/build-transfer";
import type { AnyDb } from "@/shared/db";
import { toIsoDate } from "@/shared/lib";
import type { TransactionId, UserId } from "@/shared/types/branded";
import type {
  AccountBalanceMap,
  PickerTarget,
  TransferFormInitialDraft,
  TransferFormScreenProps,
} from "./TransferForm.types";

type TransferFormHydrationSetters = {
  readonly setAccounts: Dispatch<SetStateAction<readonly FinancialAccountRow[]>>;
  readonly setBalances: Dispatch<SetStateAction<AccountBalanceMap>>;
  readonly setDate: Dispatch<SetStateAction<Date>>;
  readonly setDigits: Dispatch<SetStateAction<string>>;
  readonly setFromSide: Dispatch<SetStateAction<TransferSide | null>>;
  readonly setLastEditedSide: Dispatch<SetStateAction<PickerTarget>>;
  readonly setSourceTransaction: Dispatch<SetStateAction<StoredTransaction | null>>;
  readonly setToSide: Dispatch<SetStateAction<TransferSide | null>>;
};

type TransferFormHydrationRefs = {
  readonly appliedInitialDraftRef: MutableRefObject<boolean>;
  readonly hydratedTransactionIdRef: MutableRefObject<string | null>;
};

type TransferAccountsSnapshot = {
  readonly accounts: readonly FinancialAccountRow[];
  readonly balances: AccountBalanceMap;
  readonly defaultAccount: FinancialAccountRow | null;
};

function applyTransferDraft(
  draft: TransferFormInitialDraft,
  setters: Pick<
    TransferFormHydrationSetters,
    "setDigits" | "setFromSide" | "setLastEditedSide" | "setToSide"
  >
) {
  setters.setDigits(draft.digits);
  setters.setFromSide(draft.fromSide);
  setters.setToSide(draft.toSide);
  setters.setLastEditedSide(draft.lastEditedSide);
}

function resetHydratedTransaction(
  refs: Pick<TransferFormHydrationRefs, "appliedInitialDraftRef" | "hydratedTransactionIdRef">
) {
  refs.appliedInitialDraftRef.current = false;
  refs.hydratedTransactionIdRef.current = null;
}

function resolveTransferInitialDraft(input: {
  readonly accounts: readonly FinancialAccountRow[];
  readonly initialDraftResolver: TransferFormScreenProps["initialDraftResolver"];
  readonly refs: Pick<TransferFormHydrationRefs, "appliedInitialDraftRef">;
}) {
  return input.initialDraftResolver && !input.refs.appliedInitialDraftRef.current
    ? input.initialDraftResolver(input.accounts)
    : null;
}

function applyDefaultFromSide(
  defaultAccount: FinancialAccountRow | null,
  setFromSide: TransferFormHydrationSetters["setFromSide"]
) {
  setFromSide(
    (current) =>
      current ?? (defaultAccount ? { kind: "account", accountId: defaultAccount.id } : null)
  );
}

export function resetTransferFormHydration(
  setters: Pick<
    TransferFormHydrationSetters,
    "setAccounts" | "setBalances" | "setSourceTransaction"
  >,
  refs: Pick<TransferFormHydrationRefs, "appliedInitialDraftRef" | "hydratedTransactionIdRef">
) {
  setters.setAccounts([]);
  setters.setBalances({});
  setters.setSourceTransaction(null);
  resetHydratedTransaction(refs);
}

export function loadTransferAccountsSnapshot(db: AnyDb, userId: UserId): TransferAccountsSnapshot {
  const accounts = getFinancialAccountsForUser(db, userId);
  const balances = getFinancialAccountBalancesForUser(db, userId, toIsoDate(new Date()));

  return {
    accounts,
    balances,
    defaultAccount: accounts.find((account) => account.isDefault) ?? accounts[0] ?? null,
  };
}

export function applyCreateModeTransferHydration(input: {
  readonly initialDraftResolver: TransferFormScreenProps["initialDraftResolver"];
  readonly refs: TransferFormHydrationRefs;
  readonly setters: TransferFormHydrationSetters;
  readonly snapshot: TransferAccountsSnapshot;
}) {
  input.setters.setSourceTransaction(null);
  input.refs.hydratedTransactionIdRef.current = null;

  const initialDraft = resolveTransferInitialDraft({
    accounts: input.snapshot.accounts,
    initialDraftResolver: input.initialDraftResolver,
    refs: input.refs,
  });

  if (initialDraft) {
    applyTransferDraft(initialDraft, input.setters);
    input.refs.appliedInitialDraftRef.current = true;
    return;
  }

  if (!input.initialDraftResolver) {
    input.refs.appliedInitialDraftRef.current = false;
  }

  applyDefaultFromSide(input.snapshot.defaultAccount, input.setters.setFromSide);
}

function buildReclassificationDraft(transaction: StoredTransaction): TransferFormInitialDraft {
  const trackedSide = { kind: "account", accountId: transaction.accountId } as const;
  const externalSide = { kind: "external", label: OUTSIDE_FIDY_LABEL } as const;

  return {
    digits: String(transaction.amount),
    fromSide: transaction.type === "expense" ? trackedSide : externalSide,
    toSide: transaction.type === "expense" ? externalSide : trackedSide,
    lastEditedSide: transaction.type === "expense" ? "to" : "from",
  };
}

export function applyReclassificationTransferHydration(input: {
  readonly refs: TransferFormHydrationRefs;
  readonly setters: TransferFormHydrationSetters;
  readonly transaction: StoredTransaction;
}) {
  input.setters.setSourceTransaction(input.transaction);

  if (input.refs.hydratedTransactionIdRef.current === input.transaction.id) {
    return;
  }

  applyTransferDraft(buildReclassificationDraft(input.transaction), input.setters);
  input.setters.setDate(input.transaction.date);
  input.refs.hydratedTransactionIdRef.current = input.transaction.id;
}

export type { TransactionId };
