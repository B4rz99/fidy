import type { FinancialAccountRow } from "@/features/financial-accounts/public";
import { SelectableChipRow } from "@/shared/components/SelectableChipRow";
import { ScrollView, Text, View } from "@/shared/components/rn";
import type { FinancialAccountId } from "@/shared/types/branded";
import { styles } from "./TransactionForm.styles";

type TransactionAccountSectionProps = {
  readonly accountId: FinancialAccountId | null;
  readonly accounts: readonly FinancialAccountRow[];
  readonly label: string;
  readonly onAccountChange: (id: FinancialAccountId) => void;
  readonly secondaryColor: string;
};

export function TransactionAccountSection({
  accountId,
  accounts,
  label,
  onAccountChange,
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
        <SelectableChipRow
          className="flex-nowrap"
          chipClassName="h-auto rounded-full border border-border-subtle bg-card px-4 py-2 dark:border-border-subtle-dark dark:bg-card-dark"
          options={accounts.map((account) => ({
            value: account.id,
            label: account.name,
          }))}
          value={accountId}
          onChange={onAccountChange}
          getOptionTestID={(id) => `transaction-form.account.${id}`}
        />
      </ScrollView>
    </View>
  );
}
