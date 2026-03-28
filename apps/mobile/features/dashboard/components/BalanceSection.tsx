import { Text, View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import { formatMoney } from "@/shared/lib";
import type { CopAmount } from "@/shared/types/branded";

type BalanceSectionProps = {
  readonly balance: number;
};

export const BalanceSection = ({ balance }: BalanceSectionProps) => {
  const { t } = useTranslation();

  return (
    <View className="items-center gap-1 py-4">
      <Text className="font-poppins-medium text-label uppercase tracking-widest text-tertiary dark:text-tertiary-dark">
        {t("dashboard.spentThisMonth")}
      </Text>
      <Text className="font-poppins-bold text-balance text-primary dark:text-primary-dark">
        {formatMoney(balance as CopAmount)}
      </Text>
    </View>
  );
};
