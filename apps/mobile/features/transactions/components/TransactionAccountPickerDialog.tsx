import type { FinancialAccountRow } from "@/features/financial-accounts/public";
import { PickerDialog, PickerOptionRow } from "@/shared/components";
import { Wallet } from "@/shared/components/icons";
import { useThemeColor, useTranslation } from "@/shared/hooks";

export function TransactionAccountPickerDialog(props: {
  readonly accountId: FinancialAccountRow["id"] | null;
  readonly accounts: readonly FinancialAccountRow[];
  readonly onClose: () => void;
  readonly onSelect: (accountId: FinancialAccountRow["id"]) => void;
  readonly visible: boolean;
}) {
  const { t } = useTranslation();
  const secondary = useThemeColor("secondary");

  return (
    <PickerDialog
      visible={props.visible}
      testID="account-picker.backdrop"
      title={t("common.account")}
      onClose={props.onClose}
    >
      {props.accounts.map((account) => {
        const isSelected = account.id === props.accountId;
        return (
          <PickerOptionRow
            key={account.id}
            selected={isSelected}
            onPress={() => props.onSelect(account.id)}
            leading={<Wallet size={20} color={secondary} />}
            title={account.name}
          />
        );
      })}
    </PickerDialog>
  );
}
