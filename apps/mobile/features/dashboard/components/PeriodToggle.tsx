import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import type { DashboardPeriod } from "../lib/derive";

const PERIODS: readonly DashboardPeriod[] = ["today", "week", "month"];

const PERIOD_KEYS: Record<DashboardPeriod, string> = {
  today: "dashboard.today",
  week: "dashboard.week",
  month: "dashboard.month",
};

type Props = {
  readonly activePeriod: DashboardPeriod;
  readonly onSelect: (period: DashboardPeriod) => void;
};

export const PeriodToggle = memo(function PeriodToggle({ activePeriod, onSelect }: Props) {
  const { t } = useTranslation();
  const peachLight = useThemeColor("peachLight");
  const accentGreen = useThemeColor("accentGreen");
  const secondaryColor = useThemeColor("secondary");

  return (
    <View style={[styles.selectorContainer, { backgroundColor: peachLight }]}>
      {PERIODS.map((period) => {
        const isActive = period === activePeriod;
        return (
          <Pressable
            key={period}
            onPress={() => onSelect(period)}
            style={[styles.segment, isActive && { backgroundColor: accentGreen }]}
          >
            <Text
              style={[
                styles.segmentText,
                { color: isActive ? "#FFFFFF" : secondaryColor },
                isActive && styles.segmentTextActive,
              ]}
            >
              {t(PERIOD_KEYS[period])}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  selectorContainer: {
    height: 36,
    borderRadius: 20,
    borderCurve: "continuous",
    flexDirection: "row",
    padding: 3,
    gap: 4,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    borderCurve: "continuous",
  },
  segmentText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },
  segmentTextActive: {
    fontFamily: "Poppins_600SemiBold",
  },
});
