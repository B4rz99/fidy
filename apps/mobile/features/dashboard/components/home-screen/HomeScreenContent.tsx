import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { useCallback, useMemo } from "react";
import type { StoredActivityItem } from "@/features/activity/query.public";
import { ScreenLayout, TAB_BAR_CLEARANCE } from "@/shared/components";
import { Platform, StyleSheet } from "@/shared/components/rn";
import { EmptyTransactions } from "../EmptyTransactions";
import { ActivityFeedItem } from "./ActivityFeedItem";
import { HomeScreenActions } from "./HomeScreenActions";
import { HomeScreenHeader } from "./HomeScreenHeader";
import type { HomeScreenModel } from "./useHomeScreen";

type HomeScreenContentProps = {
  readonly model: HomeScreenModel;
};

const keyExtractor = (item: StoredActivityItem) => item.id;

export function HomeScreenContent({ model }: HomeScreenContentProps) {
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<StoredActivityItem>) => (
      <ActivityFeedItem
        item={item}
        showDateHeader={model.activityFeed.dateBreaks.has(item.id)}
        accountNames={model.activityFeed.accountNames}
        onEditTransaction={model.activityFeed.onEditTransaction}
        onDeleteTransaction={model.activityFeed.onDeleteTransaction}
      />
    ),
    [model.activityFeed]
  );

  const listHeader = useMemo(
    () => <HomeScreenHeader balance={model.balance} categorySpending={model.categorySpending} />,
    [model.balance, model.categorySpending]
  );

  const headerActions =
    Platform.OS === "ios" ? (
      <HomeScreenActions gap={20} paddingHorizontal={4} />
    ) : (
      <HomeScreenActions gap={16} />
    );

  return (
    <ScreenLayout title="fidy" rightActions={headerActions}>
      <FlashList
        data={model.activityFeed.activityPages}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onEndReached={model.activityFeed.handleEndReached}
        onEndReachedThreshold={0.1}
        scrollEventThrottle={16}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={model.showEmptyTransactions ? <EmptyTransactions /> : undefined}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        contentInset={{ bottom: TAB_BAR_CLEARANCE }}
        contentInsetAdjustmentBehavior="automatic"
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 0,
  },
});
