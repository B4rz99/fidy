import type { StoredActivityItem } from "@/features/activity/query.public";
import { getTransactionDisplayName, makeDateLabel } from "@/features/transactions/display.public";
import type { StoredTransaction } from "@/features/transactions/query.public";
import { getTransferActivityCopy } from "@/features/transfers/display.public";
import { CATEGORY_MAP } from "@/shared/categories";
import { TransactionRow } from "@/shared/components";
import { View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel, getDateFnsLocale } from "@/shared/i18n";
import { formatMoney, formatSignedMoney } from "@/shared/lib";
import type { TransactionId } from "@/shared/types/branded";
import { DateHeader } from "../DateHeader";

type TransactionActivityItemProps = {
  readonly showDateHeader: boolean;
  readonly tx: StoredTransaction;
  readonly onDeleteTransaction: (id: TransactionId) => void;
  readonly onEditTransaction: (id: TransactionId) => void;
};

function TransactionActivityItem({
  showDateHeader,
  tx,
  onDeleteTransaction,
  onEditTransaction,
}: TransactionActivityItemProps) {
  const { t, locale } = useTranslation();
  const category = CATEGORY_MAP[tx.categoryId];
  const handleEdit = () => {
    onEditTransaction(tx.id);
  };
  const handleDelete = () => {
    onDeleteTransaction(tx.id);
  };

  return (
    <View>
      {showDateHeader ? (
        <DateHeader
          label={makeDateLabel({
            date: tx.date,
            todayLabel: t("dates.today"),
            yesterdayLabel: t("dates.yesterday"),
            dateFnsLocale: getDateFnsLocale(locale),
          })}
        />
      ) : null}
      <View className="px-4 py-1">
        <TransactionRow
          icon={category?.icon ?? "✨"}
          iconBgColor="transparent"
          name={getTransactionDisplayName(tx, t("common.unknown"))}
          amount={formatSignedMoney(tx.amount, tx.type)}
          category={category ? getCategoryLabel(category, locale) : t("common.other")}
          isPositive={tx.type === "income"}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </View>
    </View>
  );
}

type TransferActivityItemProps = {
  readonly accountNames: Readonly<Record<string, string>>;
  readonly item: Extract<StoredActivityItem, { kind: "transfer" }>;
  readonly showDateHeader: boolean;
};

function TransferActivityItem({ accountNames, item, showDateHeader }: TransferActivityItemProps) {
  const { t, locale } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");
  const { title, route } = getTransferActivityCopy(item.transfer, accountNames, t);

  return (
    <View>
      {showDateHeader ? (
        <DateHeader
          label={makeDateLabel({
            date: item.date,
            todayLabel: t("dates.today"),
            yesterdayLabel: t("dates.yesterday"),
            dateFnsLocale: getDateFnsLocale(locale),
          })}
        />
      ) : null}
      <View className="px-4 py-1">
        <TransactionRow
          icon="↔️"
          iconBgColor={accentGreenLight}
          iconColor={accentGreen}
          name={title}
          amount={formatMoney(item.transfer.amount)}
          category={route}
          amountTone="neutral"
        />
      </View>
    </View>
  );
}

type ActivityFeedItemProps = {
  readonly accountNames: Readonly<Record<string, string>>;
  readonly item: StoredActivityItem;
  readonly showDateHeader: boolean;
  readonly onDeleteTransaction: (id: TransactionId) => void;
  readonly onEditTransaction: (id: TransactionId) => void;
};

export function ActivityFeedItem({
  accountNames,
  item,
  showDateHeader,
  onDeleteTransaction,
  onEditTransaction,
}: ActivityFeedItemProps) {
  return item.kind === "transaction" ? (
    <TransactionActivityItem
      tx={item.transaction}
      showDateHeader={showDateHeader}
      onEditTransaction={onEditTransaction}
      onDeleteTransaction={onDeleteTransaction}
    />
  ) : (
    <TransferActivityItem item={item} showDateHeader={showDateHeader} accountNames={accountNames} />
  );
}
