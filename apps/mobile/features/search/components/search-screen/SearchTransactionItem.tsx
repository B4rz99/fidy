import { memo } from "react";
import { useAvailableCategoryMap } from "@/features/categories/hooks.public";
import { getTransactionDisplayName, makeDateLabel } from "@/features/transactions/display.public";
import { getTransferActivityCopy } from "@/features/transfers/display.public";
import { ListDateHeader, TransactionRow } from "@/shared/components";
import { View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import { getCategoryLabel, getDateFnsLocale } from "@/shared/i18n";
import { formatMoney, formatSignedMoney } from "@/shared/lib";
import type { SearchResult } from "../../lib/types";

type SearchTransactionItemProps = {
  readonly showDateHeader: boolean;
  readonly item: SearchResult;
};

export const SearchTransactionItem = memo(function SearchTransactionItem({
  item,
  showDateHeader,
}: SearchTransactionItemProps) {
  const { t, locale } = useTranslation();
  const categoryById = useAvailableCategoryMap();
  const tx = item.kind === "transaction" ? item.transaction : null;
  const transfer = item.kind === "transfer" ? item.transfer : null;
  const category = tx ? (categoryById.get(tx.categoryId) ?? null) : null;
  const transferPresentation = transfer
    ? getTransferActivityCopy(transfer, item.kind === "transfer" ? item.accountNames : {}, t)
    : null;
  const date = tx?.date ?? transfer?.date ?? new Date();

  return (
    <View>
      {showDateHeader ? (
        <ListDateHeader
          label={makeDateLabel({
            date,
            todayLabel: t("dates.today"),
            yesterdayLabel: t("dates.yesterday"),
            dateFnsLocale: getDateFnsLocale(locale),
          })}
          variant="plain"
        />
      ) : null}
      <View className="px-4 pb-2">
        <TransactionRow
          icon={tx ? (category?.icon ?? "✨") : "↔️"}
          name={
            tx
              ? getTransactionDisplayName(tx, t("common.unknown"))
              : (transferPresentation?.title ?? t("transfers.activity.generic"))
          }
          amount={tx ? formatSignedMoney(tx.amount, tx.type) : formatMoney(transfer?.amount ?? 0)}
          category={
            tx
              ? category
                ? getCategoryLabel(category, locale)
                : t("common.other")
              : (transferPresentation?.route ?? t("search.transfers"))
          }
          isPositive={tx?.type === "income"}
          amountTone={transfer ? "neutral" : undefined}
        />
      </View>
    </View>
  );
});
