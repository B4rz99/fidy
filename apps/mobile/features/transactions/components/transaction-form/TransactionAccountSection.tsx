import type { FinancialAccountRow } from "@/features/financial-accounts";
import { Pressable, ScrollView, Text, View } from "@/shared/components/rn";
import type { FinancialAccountId } from "@/shared/types/branded";
import { styles } from "./TransactionForm.styles";

type TransactionAccountSectionProps = {
  readonly accentGreen: string;
  readonly accentGreenLight: string;
  readonly accountId: FinancialAccountId | null;
  readonly accounts: readonly FinancialAccountRow[];
  readonly borderSubtle: string;
  readonly cardColor: string;
  readonly label: string;
  readonly onAccountChange: (id: FinancialAccountId) => void;
  readonly primaryColor: string;
  readonly secondaryColor: string;
};

export function TransactionAccountSection({
  accentGreen,
  accentGreenLight,
  accountId,
  accounts,
  borderSubtle,
  cardColor,
  label,
  onAccountChange,
  primaryColor,
  secondaryColor,
}: TransactionAccountSectionProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.label, { color: secondaryColor }]}>{label}</Text>
      <ScrollView
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        <View style={styles.accountRow}>
          {accounts.map((account) => {
            const isSelected = account.id === accountId;

            return (
              <Pressable
                key={account.id}
                testID={`transaction-form.account.${account.id}`}
                style={[
                  styles.accountChip,
                  {
                    backgroundColor: isSelected ? accentGreenLight : cardColor,
                    borderColor: isSelected ? accentGreen : borderSubtle,
                  },
                ]}
                onPress={() => onAccountChange(account.id)}
                accessibilityRole="button"
                accessibilityLabel={account.name}
              >
                <Text
                  style={{
                    color: primaryColor,
                    fontFamily: isSelected ? "Poppins_600SemiBold" : "Poppins_500Medium",
                    fontSize: 12,
                  }}
                >
                  {account.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
