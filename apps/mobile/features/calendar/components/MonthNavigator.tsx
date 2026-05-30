import { MonthNavigator as SharedMonthNavigator } from "@/shared/components/MonthNavigator";
import { useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import { formatMonthYear } from "../lib/calendar-utils";

type Props = {
  currentMonth: Date;
  onPrev: () => void;
  onNext: () => void;
};

export function MonthNavigator({ currentMonth, onPrev, onNext }: Props) {
  const { locale, t } = useTranslation();

  return (
    <SharedMonthNavigator
      className="px-2 py-3"
      label={formatMonthYear(currentMonth, getDateFnsLocale(locale))}
      nextAccessibilityLabel={t("calendar.nextMonth")}
      previousAccessibilityLabel={t("calendar.previousMonth")}
      onNext={onNext}
      onPrevious={onPrev}
    />
  );
}
