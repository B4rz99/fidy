import { FlashList, type FlashListProps } from "@shopify/flash-list";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "@/shared/components/rn";

type FeedListProps<TItem> = Omit<
  FlashListProps<TItem>,
  | "contentContainerStyle"
  | "contentInsetAdjustmentBehavior"
  | "data"
  | "ItemSeparatorComponent"
  | "ListEmptyComponent"
  | "ListFooterComponent"
  | "ListHeaderComponent"
  | "renderItem"
  | "showsVerticalScrollIndicator"
> & {
  readonly containerStyle?: StyleProp<ViewStyle>;
  readonly contentContainerStyle?: FlashListProps<TItem>["contentContainerStyle"];
  readonly data: readonly TItem[];
  readonly empty?: FlashListProps<TItem>["ListEmptyComponent"];
  readonly footer?: FlashListProps<TItem>["ListFooterComponent"];
  readonly header?: FlashListProps<TItem>["ListHeaderComponent"];
  readonly itemSeparatorHeight?: number;
  readonly renderItem: NonNullable<FlashListProps<TItem>["renderItem"]>;
  readonly showsVerticalScrollIndicator?: boolean;
};

function createSeparator(height: number) {
  return function FeedListSeparator() {
    return <View style={{ height }} />;
  };
}

export function FeedList<TItem>({
  containerStyle,
  contentContainerStyle,
  empty,
  footer,
  header,
  itemSeparatorHeight,
  showsVerticalScrollIndicator = false,
  ...listProps
}: FeedListProps<TItem>) {
  const list = (
    <FlashList
      {...listProps}
      contentContainerStyle={contentContainerStyle}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
      ItemSeparatorComponent={
        itemSeparatorHeight != null ? createSeparator(itemSeparatorHeight) : undefined
      }
      ListEmptyComponent={empty}
      ListFooterComponent={footer}
      ListHeaderComponent={header}
    />
  );

  return containerStyle ? <View style={[styles.container, containerStyle]}>{list}</View> : list;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export type { FeedListProps };
