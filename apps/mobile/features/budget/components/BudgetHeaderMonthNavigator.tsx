import { MonthNavigator } from "@/shared/components/MonthNavigator";

type Props = {
  readonly monthLabel: string;
  readonly nextMonthHint: string;
  readonly nextMonthLabel: string;
  readonly onNext: () => void;
  readonly onPrev: () => void;
  readonly prevMonthHint: string;
  readonly prevMonthLabel: string;
};

export function BudgetHeaderMonthNavigator({
  monthLabel,
  nextMonthHint,
  nextMonthLabel,
  onNext,
  onPrev,
  prevMonthHint,
  prevMonthLabel,
}: Props) {
  return (
    <MonthNavigator
      label={monthLabel}
      nextAccessibilityHint={nextMonthHint}
      nextAccessibilityLabel={nextMonthLabel}
      previousAccessibilityHint={prevMonthHint}
      previousAccessibilityLabel={prevMonthLabel}
      onNext={onNext}
      onPrevious={onPrev}
    />
  );
}
