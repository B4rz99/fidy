import { GlassSurface } from "@/shared/components";
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
      <GlassSurface padded={false} radius={8} style={styles.summaryCard}>
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
      </GlassSurface>
    </View>
  );
};

const styles = StyleSheet.create({
  summaryCard: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
