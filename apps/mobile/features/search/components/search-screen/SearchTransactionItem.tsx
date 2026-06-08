import { memo } from "react";
import { getTransactionDisplayName, makeDateLabel } from "@/features/transactions/display.public";
import { getTransferActivityCopy } from "@/features/transfers/display.public";
import { CATEGORY_MAP } from "@/shared/categories";
import { GlassSurface } from "@/shared/components";
import { StyleSheet, Text, View } from "@/shared/components/rn";
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
  const tx = item.kind === "transaction" ? item.transaction : null;
  const transfer = item.kind === "transfer" ? item.transfer : null;
  const category = tx ? CATEGORY_MAP[tx.categoryId] : null;
  const transferPresentation = transfer
    ? getTransferActivityCopy(transfer, item.kind === "transfer" ? item.accountNames : {}, t)
    : null;
  const date = tx?.date ?? transfer?.date ?? new Date();

  return (
    <View>
      {showDateHeader ? (
        <View className="px-4 pt-4 pb-2">
          <Text className="font-poppins-semibold text-caption text-primary dark:text-primary-dark">
            {makeDateLabel({
              date,
              todayLabel: t("dates.today"),
              yesterdayLabel: t("dates.yesterday"),
              dateFnsLocale: getDateFnsLocale(locale),
            })}
          </Text>
        </View>
      ) : null}
      <View className="px-4 pb-2">
        <GlassSurface testID="resultCard" padded={false} radius={8} style={styles.resultCard}>
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
              {tx
                ? getTransactionDisplayName(tx, t("common.unknown"))
                : (transferPresentation?.title ?? t("transfers.activity.generic"))}
            </Text>
            <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
              {tx
                ? category
                  ? getCategoryLabel(category, locale)
                  : t("common.other")
                : (transferPresentation?.route ?? t("search.transfers"))}
            </Text>
          </View>
          <Text
            className={`font-poppins-semibold text-body ${
              tx?.type === "income"
                ? "text-accent-green dark:text-accent-green-dark"
                : transfer
                  ? "text-secondary dark:text-secondary-dark"
                  : "text-accent-red dark:text-accent-red-dark"
            }`}
          >
            {tx ? formatSignedMoney(tx.amount, tx.type) : formatMoney(transfer?.amount ?? 0)}
          </Text>
        </GlassSurface>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  resultCard: {
    alignItems: "center",
    flexDirection: "row",
    padding: 12,
  },
});
