import { memo } from "react";
import { CATEGORY_MAP, makeDateLabel, type StoredTransaction } from "@/features/transactions";
import { TransactionRow } from "@/shared/components";
import { Ellipsis } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import { getCategoryLabel, getDateFnsLocale } from "@/shared/i18n";
import { formatSignedMoney } from "@/shared/lib";

type SearchTransactionItemProps = {
  readonly showDateHeader: boolean;
  readonly tx: StoredTransaction;
};

export const SearchTransactionItem = memo(function SearchTransactionItem({
  showDateHeader,
  tx,
}: SearchTransactionItemProps) {
  const { t, locale } = useTranslation();
  const category = CATEGORY_MAP[tx.categoryId];

  return (
    <View>
      {showDateHeader ? (
        <View className="px-4 pt-4 pb-1">
          <Text className="font-poppins-semibold text-caption text-secondary dark:text-secondary-dark">
            {makeDateLabel({
              date: tx.date,
              todayLabel: t("dates.today"),
              yesterdayLabel: t("dates.yesterday"),
              dateFnsLocale: getDateFnsLocale(locale),
            })}
          </Text>
        </View>
      ) : null}
      <View className="px-4">
        <TransactionRow
          icon={category?.icon ?? Ellipsis}
          name={tx.description || t("common.unknown")}
          amount={formatSignedMoney(tx.amount, tx.type)}
          category={category ? getCategoryLabel(category, locale) : t("common.other")}
          isPositive={tx.type === "income"}
        />
      </View>
    </View>
  );
});
