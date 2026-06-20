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
  const borderStrong = useThemeColor("borderStrong");
  const peachLight = useThemeColor("peachLight");
  const surfaceMuted = useThemeColor("surfaceMuted");
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
    buttonBackground: formState.canSave ? accentGreen : borderStrong,
    buttonLabel: t(formState.buttonLabelKey),
    canSave: formState.canSave,
    dateLabel,
    hint: t(formState.hintKey),
    hintBackground: formState.sameAccountConflict ? peachLight : surfaceMuted,
    hintTone: formState.sameAccountConflict || formState.bothExternal ? accentRed : accentGreen,
    sameAccountConflict: formState.sameAccountConflict,
    subtitle: t(formState.subtitleKey),
  };
}
