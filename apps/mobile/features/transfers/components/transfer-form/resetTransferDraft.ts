import type { TransferSide } from "@/features/transfers/build.public";
import type { PickerTarget } from "./TransferForm.types";

type TransferDraftResetSetters = {
  readonly setDate: (date: Date) => void;
  readonly setDescription: (description: string) => void;
  readonly setDigits: (digits: string) => void;
  readonly setFromSide: (side: TransferSide | null) => void;
  readonly setLastEditedSide: (target: PickerTarget) => void;
  readonly setPickerTarget: (target: PickerTarget | null) => void;
  readonly setShowDatePicker: (visible: boolean) => void;
  readonly setToSide: (side: TransferSide | null) => void;
};

export function resetSavedTransferDraft(
  setters: TransferDraftResetSetters,
  defaultFromSide: TransferSide | null
): void {
  setters.setDate(new Date());
  setters.setDescription("");
  setters.setDigits("");
  setters.setFromSide(defaultFromSide);
  setters.setLastEditedSide("to");
  setters.setPickerTarget(null);
  setters.setShowDatePicker(false);
  setters.setToSide(null);
}
