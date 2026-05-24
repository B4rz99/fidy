import { memo } from "react";
import { getTransactionDisplayName, makeDateLabel } from "@/features/transactions/display.public";
import type { StoredTransaction } from "@/features/transactions/query.public";
import { CATEGORY_MAP } from "@/shared/categories";
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
        <View className="px-4 pt-4 pb-2">
          <Text className="font-poppins-semibold text-caption text-primary dark:text-primary-dark">
            {makeDateLabel({
              date: tx.date,
              todayLabel: t("dates.today"),
              yesterdayLabel: t("dates.yesterday"),
              dateFnsLocale: getDateFnsLocale(locale),
            })}
          </Text>
        </View>
      ) : null}
      <View className="px-4 pb-2">
        <View
          testID="resultCard"
          className="flex-row items-center rounded-lg bg-card/90 px-3 py-3 dark:bg-card-dark/90"
        >
          <View
            className="size-10 items-center justify-center rounded-icon"
            style={{
              backgroundColor: category?.color ?? "rgba(244, 177, 131, 0.18)",
            }}
          >
            <Text>{category?.icon ?? "✨"}</Text>
          </View>
          <View className="ml-3 flex-1">
            <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
              {getTransactionDisplayName(tx, t("common.unknown"))}
            </Text>
            <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
              {category ? getCategoryLabel(category, locale) : t("common.other")}
            </Text>
          </View>
          <Text
            className={`font-poppins-semibold text-body ${
              tx.type === "income"
                ? "text-accent-green dark:text-accent-green-dark"
                : "text-accent-red dark:text-accent-red-dark"
            }`}
          >
            {formatSignedMoney(tx.amount, tx.type)}
          </Text>
        </View>
      </View>
    </View>
  );
});
