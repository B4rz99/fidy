import * as Haptics from "expo-haptics";
import { useCallback } from "react";
import type { StoredTransaction } from "@/features/transactions";
import type { TransferSide } from "@/features/transfers/lib/build-transfer";
import { useAsyncGuard, useTranslation } from "@/shared/hooks";
import { showErrorToast } from "@/shared/lib";
import { submitTransferForm } from "./saveTransferForm";
import { getTransferErrorMessageKey } from "./TransferForm.helpers";
import type { PickerTarget } from "./TransferForm.types";

async function saveTransferFormAction(input: {
  readonly date: Date;
  readonly db: Parameters<typeof submitTransferForm>[0]["db"];
  readonly digits: string;
  readonly fromSide: TransferSide | null;
  readonly onError: (error: Parameters<typeof getTransferErrorMessageKey>[0]) => void;
  readonly onSuccessfulSave: (destination: "needs-review" | "tabs") => Promise<void> | void;
  readonly processedEmailId: Parameters<typeof submitTransferForm>[0]["processedEmailId"];
  readonly sourceTransaction: StoredTransaction | null;
  readonly toSide: TransferSide | null;
  readonly userId: Parameters<typeof submitTransferForm>[0]["userId"];
}) {
  const result = await submitTransferForm(input);

  if (!result.success) {
    input.onError(result.error);
    return;
  }

  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  await input.onSuccessfulSave(result.destination);
}

export function useTransferFormActions(input: {
  readonly date: Date;
  readonly db: Parameters<typeof submitTransferForm>[0]["db"];
  readonly digits: string;
  readonly fromSide: TransferSide | null;
  readonly isIos: boolean;
  readonly onSuccessfulSave: (destination: "needs-review" | "tabs") => Promise<void> | void;
  readonly processedEmailId: Parameters<typeof submitTransferForm>[0]["processedEmailId"];
  readonly setDate: (date: Date) => void;
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
        if (nextDate) input.setDate(nextDate);
      },
      [input]
    ),
    handlePickerClose: () => input.setPickerTarget(null),
    handleSave: () =>
      void guardedSave(() =>
        saveTransferFormAction({
          date: input.date,
          db: input.db,
          digits: input.digits,
          fromSide: input.fromSide,
          onError: (error) => showErrorToast(t(getTransferErrorMessageKey(error))),
          onSuccessfulSave: input.onSuccessfulSave,
          processedEmailId: input.processedEmailId,
          sourceTransaction: input.sourceTransaction,
          toSide: input.toSide,
          userId: input.userId,
        })
      ),
    isSaving,
  };
}
