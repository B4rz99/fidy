import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { useCallback, useMemo } from "react";
import type { StoredActivityItem } from "@/features/activity/query.public";
import { ProfileAvatarButton } from "@/features/settings/header.public";
import { ScreenLayout, TAB_BAR_CLEARANCE } from "@/shared/components";
import { Platform, StyleSheet, View } from "@/shared/components/rn";
import { useColorScheme } from "@/shared/hooks";
import { EmptyTransactions } from "../EmptyTransactions";
import { ActivityFeedItem } from "./ActivityFeedItem";
import { HomeAuroraBackground } from "./HomeAuroraBackground";
import { HomeScreenActions } from "./HomeScreenActions";
import { HomeScreenHeader } from "./HomeScreenHeader";
import type { HomeScreenModel } from "./useHomeScreen";

type HomeScreenContentProps = {
  readonly model: HomeScreenModel;
};

const keyExtractor = (item: StoredActivityItem) => item.id;

export function HomeScreenContent({ model }: HomeScreenContentProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const backgroundColor = isDark ? "#0D0D0D" : "#FDFCF9";
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
        monthlyBudget={model.monthlyBudget}
      />
    ),
    [model.balance, model.categorySpending, model.monthlyBudget]
  );

  const headerActions =
    Platform.OS === "ios" ? (
      <HomeScreenActions gap={20} paddingHorizontal={4} />
    ) : (
      <HomeScreenActions gap={16} />
    );

  return (
    <ScreenLayout
      title="fidy"
      backgroundColor={backgroundColor}
      backgroundLayer={<HomeAuroraBackground isDark={isDark} />}
      leftAction={<ProfileAvatarButton size={36} />}
      rightActions={headerActions}
      includesNativeHeader={false}
    >
      <View className="flex-1 overflow-hidden">
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
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 0,
  },
});
