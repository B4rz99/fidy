import { useTransactionStore } from "@/features/transactions/store.public";
import { EntryScaffold, type EntryTab } from "@/shared/components/EntryScaffold";
import { useTranslation } from "@/shared/hooks";
import { useTransferEntry } from "./TransferEntryContent";

export function TransferEntryScreen(
  props: {
    readonly onTransactionTabSelect?: (tab: Exclude<EntryTab, "transfer">) => void;
    readonly includesNativeHeader?: boolean;
  } = {}
) {
  const { t } = useTranslation();
  const transferEntry = useTransferEntry();
  const setTransactionType = useTransactionStore((state) => state.setType);

  const handleTabPress = (tab: EntryTab) => {
    if (tab === "transfer") return;
    setTransactionType(tab);
    props.onTransactionTabSelect?.(tab);
  };

  return (
    <>
      <EntryScaffold
        activeTab="transfer"
        amount={transferEntry.amount}
        isConfirmDisabled={transferEntry.isConfirmDisabled}
        onConfirm={transferEntry.onConfirm}
        onKeyPress={transferEntry.onKeyPress}
        onTabPress={handleTabPress}
        tabs={[
          { key: "expense", label: t("transactions.expense") },
          { key: "income", label: t("transactions.income") },
          { key: "transfer", label: t("transfers.activity.generic") },
        ]}
        fields={transferEntry.fields}
        includesNativeHeader={props.includesNativeHeader}
      />
      {transferEntry.overlays}
    </>
  );
}
