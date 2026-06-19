import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { useOptionalUserId } from "@/features/auth/public";
import { Platform } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import {
  requireProcessedSourceEventId,
  requireReviewCandidateId,
  requireTransactionId,
} from "@/shared/types/assertions";
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

function parseReclassificationProcessedSourceEventId(
  rawProcessedSourceEventId: string | string[] | undefined
) {
  return typeof rawProcessedSourceEventId === "string" &&
    rawProcessedSourceEventId.trim().length > 0
    ? requireProcessedSourceEventId(rawProcessedSourceEventId.trim())
    : null;
}

function parseReclassificationReviewCandidateId(
  rawReviewCandidateId: string | string[] | undefined
) {
  return typeof rawReviewCandidateId === "string" && rawReviewCandidateId.trim().length > 0
    ? requireReviewCandidateId(rawReviewCandidateId.trim())
    : null;
}

function parseSourceEventReviewRouteParams(input: {
  readonly processedSourceEventId: string | string[] | undefined;
  readonly reviewCandidateId: string | string[] | undefined;
}) {
  const processedSourceEventId = parseReclassificationProcessedSourceEventId(
    input.processedSourceEventId
  );
  const reviewCandidateId = parseReclassificationReviewCandidateId(input.reviewCandidateId);

  return processedSourceEventId && reviewCandidateId
    ? { processedSourceEventId, reviewCandidateId }
    : { processedSourceEventId: null, reviewCandidateId: null };
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
  const {
    transactionId: rawTransactionId,
    processedSourceEventId: rawProcessedSourceEventId,
    reviewCandidateId: rawReviewCandidateId,
  } = useLocalSearchParams<{
    transactionId?: string;
    processedSourceEventId?: string;
    reviewCandidateId?: string;
  }>();
  const { back, navigate, replace } = useRouter();
  const userId = useOptionalUserId();
  const sourceEventReviewParams = parseSourceEventReviewRouteParams({
    processedSourceEventId: rawProcessedSourceEventId,
    reviewCandidateId: rawReviewCandidateId,
  });

  return {
    db: userId ? tryGetDb(userId) : null,
    isIos: Platform.OS === "ios",
    onMissingTransaction: useCallback(() => back(), [back]),
    onSuccessfulSave: useCallback(
      (destination: "needs-review" | "tabs") =>
        navigateAfterTransferSave(destination, replace, navigate),
      [navigate, replace]
    ),
    processedSourceEventId: sourceEventReviewParams.processedSourceEventId,
    reviewCandidateId: sourceEventReviewParams.reviewCandidateId,
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
      onSuccessfulSave: props.onSuccessfulSave ?? route.onSuccessfulSave,
      processedSourceEventId: route.processedSourceEventId,
      reviewCandidateId: route.reviewCandidateId,
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
