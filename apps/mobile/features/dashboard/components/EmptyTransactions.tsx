import { BarChart3 } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

export const EmptyTransactions = () => {
  const { t } = useTranslation();
  const mutedColor = useThemeColor("secondary");

  return (
    <View className="items-center px-8 py-16" style={{ gap: 8 }}>
      <BarChart3 size={40} color={mutedColor} strokeWidth={1.5} />
      <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
        {t("transactions.noTransactionsYet")}
      </Text>
      <Text className="font-poppins-medium text-caption text-center" style={{ color: mutedColor }}>
        {t("transactions.noTransactionsHint")}
      </Text>
    </View>
  );
};
