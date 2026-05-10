import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { useOptionalUserId } from "@/features/auth/public";
import { Platform } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { requireProcessedEmailId, requireTransactionId } from "@/shared/types/assertions";
import type { TransferFormScreenProps } from "./TransferForm.types";
import { useHydrateTransferForm } from "./useHydrateTransferForm";
import { useTransferFormActions } from "./useTransferFormActions";
import { useTransferFormPresentation } from "./useTransferFormPresentation";
import { useTransferFormState } from "./useTransferFormState";

function parseReclassificationTransactionId(rawTransactionId: string | string[] | undefined) {
  return typeof rawTransactionId === "string" && rawTransactionId.trim().length > 0
    ? requireTransactionId(rawTransactionId.trim())
    : null;
}

function parseReclassificationProcessedEmailId(rawProcessedEmailId: string | string[] | undefined) {
  return typeof rawProcessedEmailId === "string" && rawProcessedEmailId.trim().length > 0
    ? requireProcessedEmailId(rawProcessedEmailId.trim())
    : null;
}

async function navigateAfterTransferSave(
  destination: "needs-review" | "tabs",
  replace: ReturnType<typeof useRouter>["replace"],
  navigate: ReturnType<typeof useRouter>["navigate"]
) {
  if (destination === "needs-review") {
    replace("/needs-review");
    return;
  }

  navigate("/(tabs)" as never);
}

function useTransferFormRouteContext() {
  const { transactionId: rawTransactionId, processedEmailId: rawProcessedEmailId } =
    useLocalSearchParams<{ transactionId?: string; processedEmailId?: string }>();
  const { back, navigate, replace } = useRouter();
  const userId = useOptionalUserId();

  return {
    db: userId ? tryGetDb(userId) : null,
    isIos: Platform.OS === "ios",
    onMissingTransaction: useCallback(() => back(), [back]),
    onSuccessfulSave: useCallback(
      (destination: "needs-review" | "tabs") =>
        navigateAfterTransferSave(destination, replace, navigate),
      [navigate, replace]
    ),
    processedEmailId: parseReclassificationProcessedEmailId(rawProcessedEmailId),
    reclassificationTransactionId: parseReclassificationTransactionId(rawTransactionId),
    userId,
  };
}

function useTransferFormDerivedState(
  route: ReturnType<typeof useTransferFormRouteContext>,
  props: TransferFormScreenProps,
  state: ReturnType<typeof useTransferFormState>
) {
  const isReclassification = state.sourceTransaction != null;
  const defaultAccount =
    state.accounts.find((account) => account.isDefault) ?? state.accounts[0] ?? null;
  const defaultFromSide = defaultAccount
    ? ({ kind: "account", accountId: defaultAccount.id } as const)
    : null;
  const presentationInput = {
    date: state.date,
    digits: state.digits,
    fromSide: state.fromSide,
    isReclassification,
    toSide: state.toSide,
  };

  return {
    actions: useTransferFormActions({
      date: state.date,
      defaultFromSide,
      description: state.description,
      db: route.db,
      digits: state.digits,
      fromSide: state.fromSide,
      isIos: route.isIos,
      onSuccessfulSave: props.onSuccessfulSave ?? route.onSuccessfulSave,
      processedEmailId: route.processedEmailId,
      setDate: state.setDate,
      setDescription: state.setDescription,
      setDigits: state.setDigits,
      setFromSide: state.setFromSide,
      setLastEditedSide: state.setLastEditedSide,
      setPickerTarget: state.setPickerTarget,
      setShowDatePicker: state.setShowDatePicker,
      setToSide: state.setToSide,
      sourceTransaction: state.sourceTransaction,
      toSide: state.toSide,
      userId: route.userId,
    }),
    isReclassification,
    presentation: useTransferFormPresentation(presentationInput),
  };
}

export function useTransferForm(props: TransferFormScreenProps) {
  const state = useTransferFormState();
  const route = useTransferFormRouteContext();
  const derived = useTransferFormDerivedState(route, props, state);

  useHydrateTransferForm({
    db: route.db,
    enabled: props.enabled ?? true,
    initialDraftResolver: props.initialDraftResolver,
    onMissingTransaction: route.onMissingTransaction,
    reclassificationTransactionId: route.reclassificationTransactionId,
    state,
    userId: route.userId,
  });

  return {
    ...state,
    ...derived.presentation,
    ...derived.actions,
    isIos: route.isIos,
    isReclassification: derived.isReclassification,
  };
}
