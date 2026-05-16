import * as Haptics from "expo-haptics";
import { useCallback } from "react";
import type { StoredTransaction } from "@/features/transactions/query.public";
import type { TransferSide } from "@/features/transfers/lib/build-transfer";
import { useAsyncGuard, useTranslation } from "@/shared/hooks";
import { clampDateToToday, showErrorToast } from "@/shared/lib";
import { resetSavedTransferDraft } from "./resetTransferDraft";
import { submitTransferForm } from "./saveTransferForm";
import { getTransferErrorMessageKey } from "./TransferForm.helpers";
import type { PickerTarget } from "./TransferForm.types";

async function saveTransferFormAction(input: {
  readonly date: Date;
  readonly defaultFromSide: TransferSide | null;
  readonly description: string;
  readonly db: Parameters<typeof submitTransferForm>[0]["db"];
  readonly digits: string;
  readonly fromSide: TransferSide | null;
  readonly onError: (error: Parameters<typeof getTransferErrorMessageKey>[0]) => void;
  readonly onSuccessfulSave: (destination: "needs-review" | "tabs") => Promise<void> | void;
  readonly processedEmailId: Parameters<typeof submitTransferForm>[0]["processedEmailId"];
  readonly processedSourceEventId: Parameters<
    typeof submitTransferForm
  >[0]["processedSourceEventId"];
  readonly reviewCandidateId: Parameters<typeof submitTransferForm>[0]["reviewCandidateId"];
  readonly resetDraft: (() => void) | null;
  readonly sourceTransaction: StoredTransaction | null;
  readonly toSide: TransferSide | null;
  readonly userId: Parameters<typeof submitTransferForm>[0]["userId"];
}) {
  const result = await submitTransferForm({ ...input, date: clampDateToToday(input.date) });

  if (!result.success) {
    input.onError(result.error);
    return;
  }

  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  await input.onSuccessfulSave(result.destination);
  input.resetDraft?.();
}

export function useTransferFormActions(input: {
  readonly date: Date;
  readonly defaultFromSide: TransferSide | null;
  readonly description: string;
  readonly db: Parameters<typeof submitTransferForm>[0]["db"];
  readonly digits: string;
  readonly fromSide: TransferSide | null;
  readonly isIos: boolean;
  readonly onSuccessfulSave: (destination: "needs-review" | "tabs") => Promise<void> | void;
  readonly processedEmailId: Parameters<typeof submitTransferForm>[0]["processedEmailId"];
  readonly processedSourceEventId: Parameters<
    typeof submitTransferForm
  >[0]["processedSourceEventId"];
  readonly reviewCandidateId: Parameters<typeof submitTransferForm>[0]["reviewCandidateId"];
  readonly setDate: (date: Date) => void;
  readonly setDescription: (description: string) => void;
  readonly setDigits: (digits: string) => void;
  readonly setFromSide: (
    side: TransferSide | null | ((current: TransferSide | null) => TransferSide | null)
  ) => void;
  readonly setLastEditedSide: (target: PickerTarget) => void;
  readonly setPickerTarget: (target: PickerTarget | null) => void;
  readonly setShowDatePicker: (visible: boolean) => void;
  readonly setToSide: (
    side: TransferSide | null | ((current: TransferSide | null) => TransferSide | null)
  ) => void;
  readonly sourceTransaction: StoredTransaction | null;
  readonly toSide: TransferSide | null;
  readonly userId: Parameters<typeof submitTransferForm>[0]["userId"];
}) {
  const { t } = useTranslation();
  const { isBusy: isSaving, run: guardedSave } = useAsyncGuard();

  return {
    applySelectedSide: useCallback(
      (target: PickerTarget, nextSide: TransferSide) => {
        input.setLastEditedSide(target);
        if (target === "from") input.setFromSide(nextSide);
        else input.setToSide(nextSide);
        input.setPickerTarget(null);
      },
      [input]
    ),
    handleDateChange: useCallback(
      (_event: unknown, nextDate?: Date) => {
        if (!input.isIos) input.setShowDatePicker(false);
        if (isDatePickerDismissed(_event)) return;
        if (nextDate) input.setDate(clampDateToToday(nextDate));
      },
      [input]
    ),
    handlePickerClose: () => input.setPickerTarget(null),
    handleSave: () =>
      void guardedSave(() =>
        saveTransferFormAction({
          date: input.date,
          defaultFromSide: input.defaultFromSide,
          description: input.description,
          db: input.db,
          digits: input.digits,
          fromSide: input.fromSide,
          onError: (error) => showErrorToast(t(getTransferErrorMessageKey(error))),
          onSuccessfulSave: input.onSuccessfulSave,
          processedEmailId: input.processedEmailId,
          processedSourceEventId: input.processedSourceEventId,
          reviewCandidateId: input.reviewCandidateId,
          resetDraft:
            input.sourceTransaction == null
              ? () => resetSavedTransferDraft(input, input.defaultFromSide)
              : null,
          sourceTransaction: input.sourceTransaction,
          toSide: input.toSide,
          userId: input.userId,
        })
      ),
    isSaving,
  };
}

function isDatePickerDismissed(event: unknown) {
  return (
    typeof event === "object" && event !== null && "type" in event && event.type === "dismissed"
  );
}
