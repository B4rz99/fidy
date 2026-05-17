import { getDateLabel } from "@/features/transactions/display.public";
import type { TransferSide } from "@/features/transfers/build.public";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import { parseDigitsToAmount } from "@/shared/lib";
import { getTransferFormPresentationState } from "./TransferForm.helpers";

export function useTransferFormPresentation(input: {
  readonly date: Date;
  readonly digits: string;
  readonly fromSide: TransferSide | null;
  readonly isReclassification: boolean;
  readonly toSide: TransferSide | null;
}) {
  const { t, locale } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const formState = getTransferFormPresentationState({
    amount: parseDigitsToAmount(input.digits),
    fromSide: input.fromSide,
    isReclassification: input.isReclassification,
    toSide: input.toSide,
  });
  const dateLabel = getDateLabel({
    date: input.date,
    now: new Date(),
    todayLabel: t("dates.today"),
    dateFnsLocale: getDateFnsLocale(locale),
  });

  return {
    buttonBackground: formState.canSave ? accentGreen : "#DADADA",
    buttonLabel: t(formState.buttonLabelKey),
    canSave: formState.canSave,
    dateLabel,
    hint: t(formState.hintKey),
    hintBackground: formState.sameAccountConflict ? "#FFF2F0" : "#F7F2EE",
    hintTone: formState.sameAccountConflict || formState.bothExternal ? accentRed : accentGreen,
    sameAccountConflict: formState.sameAccountConflict,
    subtitle: t(formState.subtitleKey),
  };
}
