import { Text, View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import { formatMoney } from "@/shared/lib";
import type { CopAmount } from "@/shared/types/branded";
import type { SearchSummary } from "../lib/types";

type ResultsSummaryProps = {
  summary: SearchSummary;
};

export const ResultsSummary = ({ summary }: ResultsSummaryProps) => {
  const { t } = useTranslation();

  return (
    <View className="px-4 py-2">
      <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
        {t("search.resultsSummary", {
          count: summary.count,
          total: formatMoney(summary.total as CopAmount),
        })}
      </Text>
    </View>
  );
};
