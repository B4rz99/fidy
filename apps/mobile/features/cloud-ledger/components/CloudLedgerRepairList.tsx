import { Button, Card, EmptyState, TAB_BAR_CLEARANCE } from "@/shared/components";
import { ScrollView, Text, View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import type { LedgerChangeId } from "@/shared/types/branded";
import type { CloudLedgerRepairAction, CloudLedgerRepairItem } from "../outbox";
import { describeCloudLedgerRepairItem } from "../repair-copy";

type CloudLedgerRepairListProps = {
  readonly items: readonly CloudLedgerRepairItem[];
  readonly onDiscard: (changeId: LedgerChangeId) => void;
  readonly onEditAndResubmit: (changeId: LedgerChangeId) => void;
  readonly onRetry: (changeId: LedgerChangeId) => void;
  readonly onRetrySet?: () => void;
};

export function CloudLedgerRepairList({
  items,
  onDiscard,
  onEditAndResubmit,
  onRetry,
  onRetrySet,
}: CloudLedgerRepairListProps) {
  const { t } = useTranslation();
  const canRetrySet =
    onRetrySet !== undefined &&
    items.length > 1 &&
    items.every((item) => item.actions.includes("retry"));

  if (items.length === 0) {
    return (
      <EmptyState
        title={t("cloudLedger.repair.emptyTitle")}
        subtitle={t("cloudLedger.repair.emptyBody")}
      />
    );
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 16 + TAB_BAR_CLEARANCE,
        gap: 12,
      }}
      contentInset={{ bottom: TAB_BAR_CLEARANCE }}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      {canRetrySet ? (
        <Button
          label={t("cloudLedger.repair.actions.retrySet")}
          size="compact"
          variant="secondary"
          onPress={onRetrySet}
        />
      ) : null}
      {items.map((item) => (
        <CloudLedgerRepairCard
          key={item.id}
          item={item}
          onDiscard={onDiscard}
          onEditAndResubmit={onEditAndResubmit}
          onRetry={onRetry}
        />
      ))}
    </ScrollView>
  );
}

function CloudLedgerRepairCard({
  item,
  onDiscard,
  onEditAndResubmit,
  onRetry,
}: Omit<CloudLedgerRepairListProps, "items"> & { readonly item: CloudLedgerRepairItem }) {
  const { t } = useTranslation();
  const copy = describeCloudLedgerRepairItem(item, t);

  return (
    <Card radius={8} contentStyle={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Text className="font-poppins-semibold text-section text-text-primary dark:text-text-primary-dark">
          {copy.title}
        </Text>
        <Text className="font-poppins text-caption text-text-secondary dark:text-text-secondary-dark">
          {copy.body}
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        {copy.actionLabels.map(({ action, label }) => (
          <Button
            key={action}
            label={label}
            size="compact"
            variant={buttonVariant(action)}
            onPress={() =>
              dispatchRepairAction({
                action,
                changeId: item.id,
                onDiscard,
                onEditAndResubmit,
                onRetry,
              })
            }
          />
        ))}
      </View>
    </Card>
  );
}

function buttonVariant(
  action: CloudLedgerRepairAction
): "dangerSecondary" | "primary" | "secondary" {
  if (action === "discard") {
    return "dangerSecondary";
  }
  return action === "editAndResubmit" ? "primary" : "secondary";
}

function dispatchRepairAction(input: {
  readonly action: CloudLedgerRepairAction;
  readonly changeId: LedgerChangeId;
  readonly onDiscard: (changeId: LedgerChangeId) => void;
  readonly onEditAndResubmit: (changeId: LedgerChangeId) => void;
  readonly onRetry: (changeId: LedgerChangeId) => void;
}): void {
  if (input.action === "discard") {
    input.onDiscard(input.changeId);
    return;
  }
  if (input.action === "editAndResubmit") {
    input.onEditAndResubmit(input.changeId);
    return;
  }
  input.onRetry(input.changeId);
}
