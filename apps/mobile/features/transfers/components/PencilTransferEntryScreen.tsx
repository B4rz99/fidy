import { useTransactionStore } from "@/features/transactions/store.public";
import { PencilEntryScaffold, type PencilEntryTab } from "@/shared/components/PencilEntryScaffold";
import { useTranslation } from "@/shared/hooks";
import { usePencilTransferEntry } from "./PencilTransferEntryContent";

export function PencilTransferEntryScreen(
  props: {
    readonly onTransactionTabSelect?: (tab: Exclude<PencilEntryTab, "transfer">) => void;
    readonly includesNativeHeader?: boolean;
  } = {}
) {
  const { t } = useTranslation();
  const transferEntry = usePencilTransferEntry();
  const setTransactionType = useTransactionStore((state) => state.setType);

  const handleTabPress = (tab: PencilEntryTab) => {
    if (tab === "transfer") return;
    setTransactionType(tab);
    props.onTransactionTabSelect?.(tab);
  };

  return (
    <>
      <PencilEntryScaffold
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
