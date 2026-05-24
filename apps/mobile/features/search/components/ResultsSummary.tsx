import { StyleSheet, Text, View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import { formatMoney } from "@/shared/lib";
import type { SearchSummary } from "../lib/types";

type ResultsSummaryProps = {
  summary: SearchSummary;
};

export const ResultsSummary = ({ summary }: ResultsSummaryProps) => {
  const { t } = useTranslation();

  return (
    <View className="px-4 pb-2">
      <View
        className="flex-row rounded-lg bg-card/90 px-4 py-3 dark:bg-card-dark/90"
        style={styles.summaryCard}
      >
        <View className="flex-1">
          <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
            {t("search.resultTotal")}
          </Text>
          <Text className="font-poppins-semibold text-title text-primary dark:text-primary-dark">
            {formatMoney(summary.total)}
          </Text>
        </View>
        <View className="items-end">
          <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
            {t("search.movements")}
          </Text>
          <Text className="font-poppins-semibold text-title text-primary dark:text-primary-dark">
            {summary.count}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  summaryCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(15, 23, 42, 0.08)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
});
