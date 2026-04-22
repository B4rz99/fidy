import { useRouter } from "expo-router";
import { useState } from "react";
import { useOptionalUserId } from "@/features/auth";
import type { FinancialAccountKind } from "@/features/financial-accounts";
import { hasInvalidBillingDayInput } from "@/features/financial-accounts/lib/form-screen";
import { readFinancialAccountKind } from "@/features/financial-accounts/lib/kind";
import { createFinancialAccountManagementService } from "@/features/financial-accounts/lib/management-service";
import type { AnyDb } from "@/shared/db";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useTranslation } from "@/shared/hooks";
import {
  cleanDigitInput,
  formatMoney,
  parseDigitsToAmount,
  parseOptionalIsoDate,
  showErrorToast,
  toIsoDate,
} from "@/shared/lib";
import type { CopAmount, IsoDate, UserId } from "@/shared/types/branded";

const managementService = createFinancialAccountManagementService();

export type FinancialAccountFormDetails = NonNullable<
  ReturnType<typeof managementService.getAccountDetails>
>;

type ParsedFinancialAccountFormValues = {
  readonly openingBalanceAmount: CopAmount | null;
  readonly openingBalanceEffectiveDate: IsoDate | null;
  readonly statementClosingDay: number | null;
  readonly paymentDueDay: number | null;
};

type PersistFinancialAccountFormInput = ParsedFinancialAccountFormValues & {
  readonly db: AnyDb | null;
  readonly existingDetails: FinancialAccountFormDetails | null;
  readonly kind: FinancialAccountKind;
  readonly manualIdentifierValue: string;
  readonly name: string;
  readonly onError: () => void;
  readonly onSuccess: () => void;
  readonly userId: UserId | null | undefined;
};

function parseOptionalDay(value: string): number | null {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  return /^\d+$/.test(trimmedValue) ? Number.parseInt(trimmedValue, 10) : Number.NaN;
}

function parseFinancialAccountFormValues(input: {
  readonly amountDigits: string;
  readonly effectiveDate: Date | null;
  readonly paymentDueDayText: string;
  readonly statementClosingDayText: string;
}): ParsedFinancialAccountFormValues {
  return {
    openingBalanceAmount:
      input.amountDigits.length > 0 ? parseDigitsToAmount(input.amountDigits) : null,
    openingBalanceEffectiveDate: input.effectiveDate ? toIsoDate(input.effectiveDate) : null,
    paymentDueDay: parseOptionalDay(input.paymentDueDayText),
    statementClosingDay: parseOptionalDay(input.statementClosingDayText),
  };
}

function hasPartialOpeningBalance(values: ParsedFinancialAccountFormValues) {
  return (
    (values.openingBalanceAmount != null && values.openingBalanceEffectiveDate == null) ||
    (values.openingBalanceAmount == null && values.openingBalanceEffectiveDate != null)
  );
}

function hasInvalidBillingDay(
  values: ParsedFinancialAccountFormValues,
  kind: FinancialAccountKind
) {
  return hasInvalidBillingDayInput({
    kind,
    statementClosingDay: values.statementClosingDay,
    paymentDueDay: values.paymentDueDay,
  });
}

function getFinancialAccountFormErrorKey(input: {
  readonly kind: FinancialAccountKind;
  readonly values: ParsedFinancialAccountFormValues;
}) {
  if (hasPartialOpeningBalance(input.values)) {
    return "financialAccounts.form.invalidOpeningBalance";
  }

  return hasInvalidBillingDay(input.values, input.kind)
    ? "financialAccounts.form.invalidBillingDay"
    : null;
}

function persistExistingFinancialAccountForm(
  input: PersistFinancialAccountFormInput & {
    readonly db: AnyDb;
    readonly existingDetails: FinancialAccountFormDetails;
    readonly userId: UserId;
  }
) {
  managementService.updateAccount({
    db: input.db,
    userId: input.userId,
    accountId: input.existingDetails.account.id,
    name: input.name,
    kind: input.kind,
    openingBalanceAmount: input.openingBalanceAmount,
    openingBalanceEffectiveDate: input.openingBalanceEffectiveDate,
    statementClosingDay: input.statementClosingDay,
    paymentDueDay: input.paymentDueDay,
  });
}

function persistNewFinancialAccountForm(
  input: PersistFinancialAccountFormInput & {
    readonly db: AnyDb;
    readonly userId: UserId;
  }
) {
  managementService.createAccount({
    db: input.db,
    userId: input.userId,
    name: input.name,
    kind: input.kind,
    openingBalanceAmount: input.openingBalanceAmount,
    openingBalanceEffectiveDate: input.openingBalanceEffectiveDate,
    manualIdentifierValue: input.manualIdentifierValue,
    statementClosingDay: input.statementClosingDay,
    paymentDueDay: input.paymentDueDay,
  });
}

function persistFinancialAccountForm(input: PersistFinancialAccountFormInput) {
  if (!input.db || !input.userId) {
    return;
  }

  if (input.existingDetails) {
    persistExistingFinancialAccountForm({
      ...input,
      db: input.db,
      existingDetails: input.existingDetails,
      userId: input.userId,
    });
  } else {
    persistNewFinancialAccountForm({
      ...input,
      db: input.db,
      userId: input.userId,
    });
  }

  input.onSuccess();
}

async function runFinancialAccountFormSave(input: PersistFinancialAccountFormInput) {
  try {
    persistFinancialAccountForm(input);
  } catch {
    input.onError();
  }
}

export function useFinancialAccountForm({
  existingDetails,
}: {
  readonly existingDetails: FinancialAccountFormDetails | null;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const existingOpeningBalance = existingDetails?.openingBalance ?? null;
  const [name, setName] = useState(existingDetails?.account.name ?? "");
  const [kind, setKind] = useState<FinancialAccountKind>(
    existingDetails ? readFinancialAccountKind(existingDetails.account.kind) : "checking"
  );
  const [amountDigits, setAmountDigits] = useState(
    existingOpeningBalance ? String(existingOpeningBalance.amount) : ""
  );
  const [effectiveDate, setEffectiveDate] = useState<Date | null>(
    parseOptionalIsoDate(existingOpeningBalance?.effectiveDate)
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [manualIdentifierValue, setManualIdentifierValue] = useState("");
  const [statementClosingDayText, setStatementClosingDayText] = useState(
    existingDetails?.account.statementClosingDay?.toString() ?? ""
  );
  const [paymentDueDayText, setPaymentDueDayText] = useState(
    existingDetails?.account.paymentDueDay?.toString() ?? ""
  );
  const { isBusy, run: guardedSave } = useAsyncGuard();
  const isEdit = existingDetails != null;
  const amountPreview =
    amountDigits.length > 0 ? formatMoney(parseDigitsToAmount(amountDigits)) : null;

  const handleSave = () => {
    const parsedValues = parseFinancialAccountFormValues({
      amountDigits,
      effectiveDate,
      paymentDueDayText,
      statementClosingDayText,
    });
    const formErrorKey = getFinancialAccountFormErrorKey({ kind, values: parsedValues });

    if (formErrorKey) {
      showErrorToast(t(formErrorKey));
      return;
    }

    void guardedSave(() =>
      runFinancialAccountFormSave({
        db,
        userId,
        existingDetails: isEdit ? existingDetails : null,
        kind,
        manualIdentifierValue,
        name,
        onError: () => showErrorToast(t("financialAccounts.form.saveFailed")),
        onSuccess: () => router.back(),
        ...parsedValues,
      })
    );
  };

  return {
    amountDigits,
    amountPreview,
    effectiveDate,
    handleSave,
    isBusy,
    isEdit,
    kind,
    manualIdentifierValue,
    name,
    paymentDueDayText,
    setAmountDigits: (value: string) => setAmountDigits(cleanDigitInput(value)),
    setEffectiveDate,
    setKind,
    setManualIdentifierValue,
    setName,
    setPaymentDueDayText,
    setShowDatePicker,
    setStatementClosingDayText,
    showDatePicker,
    statementClosingDayText,
  };
}
