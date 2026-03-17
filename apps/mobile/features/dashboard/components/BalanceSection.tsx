import { TrendingUp } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
import { formatCents } from "@/features/transactions";
import { useThemeColor } from "@/shared/hooks";

type BalanceSectionProps = {
  readonly balanceCents: number;
};

export const BalanceSection = ({ balanceCents }: BalanceSectionProps) => {
  const greenColor = useThemeColor("accentGreen");

  return (
    <View className="items-center gap-1 py-4">
      <Text className="font-poppins-medium text-label uppercase tracking-widest text-tertiary dark:text-tertiary-dark">
        TOTAL BALANCE
      </Text>
      <Text className="font-poppins-bold text-balance text-primary dark:text-primary-dark">
        {formatCents(balanceCents)}
      </Text>
      <View className="flex-row items-center gap-1">
        <TrendingUp size={14} color={greenColor} />
        <Text className="font-poppins-medium text-label text-accent-green dark:text-accent-green-dark">
          +2.4% this month
        </Text>
      </View>
    </View>
  );
};
