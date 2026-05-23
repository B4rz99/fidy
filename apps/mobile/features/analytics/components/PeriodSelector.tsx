import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
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
  const peachLight = useThemeColor("peachLight");
  const accentGreen = useThemeColor("accentGreen");
  const secondaryColor = useThemeColor("secondary");
  const { t } = useTranslation();

  return (
    <View style={[styles.selectorContainer, { backgroundColor: peachLight }]}>
      {PERIOD_OPTIONS.map(({ accessibilityLabelKey, labelKey, period }) => {
        const isActive = period === activePeriod;
        return (
          <Pressable
            key={period}
            accessibilityRole="button"
            accessibilityLabel={t(accessibilityLabelKey)}
            accessibilityState={{ selected: isActive }}
            onPress={() => onSelect(period)}
            style={[styles.segment, isActive && { backgroundColor: accentGreen }]}
          >
            <Text
              style={[
                styles.segmentText,
                // White on accentGreen has sufficient contrast in both light and dark themes
                { color: isActive ? "#FFFFFF" : secondaryColor },
                isActive && styles.segmentTextActive,
              ]}
            >
              {t(labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  selectorContainer: {
    height: 32,
    borderRadius: 16,
    borderCurve: "continuous",
    flexDirection: "row",
    padding: 3,
    gap: 4,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderCurve: "continuous",
  },
  segmentText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  segmentTextActive: {
    fontFamily: "Poppins_600SemiBold",
  },
});
