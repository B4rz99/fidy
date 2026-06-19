import { memo } from "react";
import { SegmentedControl } from "@/shared/components/SegmentedControl";
import { useTranslation } from "@/shared/hooks";
import type { AnalyticsPeriod } from "../lib/derive";

const PERIOD_OPTIONS: readonly {
  readonly accessibilityLabelKey: string;
  readonly labelKey: string;
  readonly period: AnalyticsPeriod;
}[] = [
  {
    period: "W",
    labelKey: "analytics.period.week",
    accessibilityLabelKey: "analytics.periodAccessibility.week",
  },
  {
    period: "M",
    labelKey: "analytics.period.month",
    accessibilityLabelKey: "analytics.periodAccessibility.month",
  },
  {
    period: "Q",
    labelKey: "analytics.period.quarter",
    accessibilityLabelKey: "analytics.periodAccessibility.quarter",
  },
  {
    period: "Y",
    labelKey: "analytics.period.year",
    accessibilityLabelKey: "analytics.periodAccessibility.year",
  },
];

type PeriodSelectorProps = {
  readonly activePeriod: AnalyticsPeriod;
  readonly onSelect: (period: AnalyticsPeriod) => void;
};

export const PeriodSelector = memo(function PeriodSelector({
  activePeriod,
  onSelect,
}: PeriodSelectorProps) {
  const { t } = useTranslation();

  return (
    <SegmentedControl
      options={PERIOD_OPTIONS.map(({ accessibilityLabelKey, labelKey, period }) => ({
        value: period,
        label: t(labelKey),
        accessibilityLabel: t(accessibilityLabelKey),
      }))}
      value={activePeriod}
      onChange={onSelect}
      tone="success"
      variant="detached"
      style={{ height: 32 }}
    />
  );
});
