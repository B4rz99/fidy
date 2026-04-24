import type { FinancialAccountRow } from "@/features/financial-accounts/public";
import type { TransferSide } from "@/features/transfers/lib/build-transfer";

export type PickerTarget = "from" | "to";

export type AccountBalanceMap = Readonly<Record<string, number>>;

export type TransferFormInitialDraft = {
  readonly digits: string;
  readonly fromSide: TransferSide;
  readonly toSide: TransferSide;
  readonly lastEditedSide: PickerTarget;
};

export type TransferFormScreenProps = {
  readonly initialDraftResolver?: (
    accounts: readonly FinancialAccountRow[]
  ) => TransferFormInitialDraft | null;
};

export const TRANSFER_FORM_TEST_IDS = {
  amount: "transfer.form.amount",
  date: "transfer.form.date",
  fromSide: "transfer.form.from-side",
  pickerAccountPrefix: "transfer.picker.account.",
  pickerOutsideFidy: "transfer.picker.outside-fidy",
  pickerSheet: "transfer.picker.sheet",
  save: "transfer.form.save",
  toSide: "transfer.form.to-side",
} as const;
