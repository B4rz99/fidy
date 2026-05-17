import { Stack } from "expo-router";
import { useCallback, useMemo } from "react";
import type { ListRenderItemInfo } from "react-native";
import type { StoredActivityItem } from "@/features/activity/query.public";
import { ScreenLayout, TAB_BAR_CLEARANCE } from "@/shared/components";
import { FlatList, Platform } from "@/shared/components/rn";
import { EmptyTransactions } from "../EmptyTransactions";
import { ActivityFeedItem } from "./ActivityFeedItem";
import { HomeScreenActions } from "./HomeScreenActions";
import { HomeScreenHeader } from "./HomeScreenHeader";
import type { HomeScreenModel } from "./useHomeScreen";

type HomeScreenContentProps = {
  readonly model: HomeScreenModel;
};

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
    () => (
      <HomeScreenHeader
        balance={model.balance}
        categorySpending={model.categorySpending}
        dailySpending={model.dailySpending}
      />
    ),
    [model.balance, model.categorySpending, model.dailySpending]
  );

  return (
    <ScreenLayout
      title="fidy"
      rightActions={Platform.OS !== "ios" ? <HomeScreenActions gap={16} /> : undefined}
    >
      {Platform.OS === "ios" ? (
        <Stack.Screen
          options={{
            headerTitle: "",
            headerRight: () => <HomeScreenActions gap={20} paddingHorizontal={4} />,
          }}
        />
      ) : null}
      <FlatList
        data={model.activityFeed.activityPages}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        onEndReached={model.activityFeed.handleEndReached}
        onEndReachedThreshold={0.1}
        scrollEventThrottle={16}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={model.showEmptyTransactions ? <EmptyTransactions /> : undefined}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 0 }}
        contentInset={{ bottom: TAB_BAR_CLEARANCE }}
        contentInsetAdjustmentBehavior="automatic"
      />
    </ScreenLayout>
  );
}
