import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { getStoredTransactionById } from "@/features/transactions/store.public";
import type { AnyDb } from "@/shared/db";
import type { UserId } from "@/shared/types/branded";
import type { TransactionId } from "./hydration";
import {
  applyCreateModeTransferHydration,
  applyReclassificationTransferHydration,
  loadTransferAccountsSnapshot,
  resetTransferFormHydration,
} from "./hydration";
import type { TransferFormScreenProps } from "./TransferForm.types";
import type { TransferFormState } from "./useTransferFormState";

type TransferFormHydrationState = Pick<
  TransferFormState,
  | "appliedInitialDraftRef"
  | "hydratedTransactionIdRef"
  | "setAccounts"
  | "setBalances"
  | "setDate"
  | "setDigits"
  | "setFromSide"
  | "setLastEditedSide"
  | "setSourceTransaction"
  | "setToSide"
>;

function loadTransferFormOnFocus(input: {
  readonly db: AnyDb | null;
  readonly initialDraftResolver: TransferFormScreenProps["initialDraftResolver"];
  readonly onMissingTransaction: () => void;
  readonly reclassificationTransactionId: TransactionId | null;
  readonly state: TransferFormHydrationState;
  readonly userId: UserId | null | undefined;
}) {
  if (!input.db || !input.userId) {
    resetTransferFormHydration(input.state, input.state);
    return;
  }

  const snapshot = loadTransferAccountsSnapshot(input.db, input.userId);
  input.state.setAccounts(snapshot.accounts);
  input.state.setBalances(snapshot.balances);

  if (input.reclassificationTransactionId == null) {
    applyCreateModeTransferHydration({
      initialDraftResolver: input.initialDraftResolver,
      refs: input.state,
      setters: input.state,
      snapshot,
    });
    return;
  }

  const transaction = getStoredTransactionById(
    input.db,
    input.userId,
    input.reclassificationTransactionId
  );
  if (!transaction) {
    input.onMissingTransaction();
    return;
  }

  applyReclassificationTransferHydration({
    refs: input.state,
    setters: input.state,
    transaction,
  });
}

export function useHydrateTransferForm(input: {
  readonly db: AnyDb | null;
  readonly enabled: boolean;
  readonly initialDraftResolver: TransferFormScreenProps["initialDraftResolver"];
  readonly onMissingTransaction: () => void;
  readonly reclassificationTransactionId: TransactionId | null;
  readonly state: TransferFormState;
  readonly userId: UserId | null | undefined;
}) {
  const {
    db,
    enabled,
    initialDraftResolver,
    onMissingTransaction,
    reclassificationTransactionId,
    userId,
  } = input;
  const {
    appliedInitialDraftRef,
    hydratedTransactionIdRef,
    setAccounts,
    setBalances,
    setDate,
    setDigits,
    setFromSide,
    setLastEditedSide,
    setSourceTransaction,
    setToSide,
  } = input.state;

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;

      loadTransferFormOnFocus({
        db,
        initialDraftResolver,
        onMissingTransaction,
        reclassificationTransactionId,
        state: {
          appliedInitialDraftRef,
          hydratedTransactionIdRef,
          setAccounts,
          setBalances,
          setDate,
          setDigits,
          setFromSide,
          setLastEditedSide,
          setSourceTransaction,
          setToSide,
        },
        userId,
      });
    }, [
      appliedInitialDraftRef,
      db,
      enabled,
      hydratedTransactionIdRef,
      initialDraftResolver,
      onMissingTransaction,
      reclassificationTransactionId,
      setAccounts,
      setBalances,
      setDate,
      setDigits,
      setFromSide,
      setLastEditedSide,
      setSourceTransaction,
      setToSide,
      userId,
    ])
  );
}
