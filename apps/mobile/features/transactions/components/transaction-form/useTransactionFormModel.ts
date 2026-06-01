import { useCallback, useState } from "react";
import { useBlinkingCursor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import { parseDigitsToAmount } from "@/shared/lib";
import { hasSelectedFinancialAccount } from "../../lib/account-selection";
import { getDateLabel } from "../../lib/format-date";
import { handleNumpadPress } from "../../lib/handle-numpad-press";
import type { TransactionFormModel, TransactionFormProps } from "./TransactionForm.types";

type TransactionFormModelInput = Pick<
  TransactionFormProps,
  "accountId" | "accounts" | "date" | "digits" | "onDigitsChange"
>;

export function useTransactionFormModel(args: TransactionFormModelInput): TransactionFormModel {
  const { accountId, accounts, date, digits, onDigitsChange } = args;
  const { t, locale } = useTranslation();
  const { cursorStyle } = useBlinkingCursor();
  const [descriptionFocused, setDescriptionFocused] = useState(false);
  const canSave =
    parseDigitsToAmount(digits) > 0 && hasSelectedFinancialAccount(accounts, accountId);
  const dateLabel = getDateLabel({
    date,
    now: new Date(),
    todayLabel: t("dates.today"),
    dateFnsLocale: getDateFnsLocale(locale),
  });

  return {
    canSave,
    cursorStyle,
    dateLabel,
    descriptionFocused,
    handleDescriptionBlur: useCallback(() => {
      setDescriptionFocused(false);
    }, []),
    handleDescriptionFocus: useCallback(() => {
      setDescriptionFocused(true);
    }, []),
    handleKey: useCallback(
      (key: string) => {
        onDigitsChange((currentDigits) => handleNumpadPress(currentDigits, key));
      },
      [onDigitsChange]
    ),
  };
}
