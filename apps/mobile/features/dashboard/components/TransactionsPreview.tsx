import { useColorScheme, View } from "react-native";
import { SectionHeader } from "@/shared/components/SectionHeader";
import { TransactionRow } from "@/shared/components/TransactionRow";
import { recentTransactions } from "../data/mock-data";

export const TransactionsPreview = () => {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === "dark" ? "dark" : "light";

  return (
    <View className="gap-1">
      <SectionHeader title="Transactions" actionLabel="See all" />
      <View>
        {recentTransactions.map((tx) => (
          <TransactionRow
            key={tx.id}
            icon={tx.icon}
            iconBgColor={tx.iconBgColor?.[scheme]}
            name={tx.name}
            date={tx.date}
            amount={tx.amount}
            category={tx.category}
            isPositive={tx.isPositive}
          />
        ))}
      </View>
    </View>
  );
};
