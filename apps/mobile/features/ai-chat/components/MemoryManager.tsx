import { FlashList } from "@shopify/flash-list";
import { memo, useCallback } from "react";
import { ScreenLayout, TAB_BAR_CLEARANCE } from "@/shared/components";
import { Trash2 } from "@/shared/components/icons";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import type { UserMemoryId } from "@/shared/types/branded";
import { useDeleteUserMemoryMutation, useUserMemoriesQuery } from "../hooks/use-user-memories";
import type { UserMemory } from "../schema";

type MemoryManagerProps = {
  readonly onBack: () => void;
};

const ItemSeparator = () => <View style={{ height: 8 }} />;

const MemoryCard = memo(function MemoryCardInner({
  memory,
  onDelete,
}: {
  readonly memory: UserMemory;
  readonly onDelete: () => void;
}) {
  const { t } = useTranslation();
  const accentRed = useThemeColor("accentRed");
  const translated = t(`aiChat.memoryCategories.${memory.category}`);
  const categoryLabel =
    typeof translated === "string" && !translated.startsWith("[missing")
      ? translated
      : memory.category;

  return (
    <View
      className="bg-card dark:bg-card-dark"
      style={{
        borderRadius: 16,
        padding: 16,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text className="font-poppins-medium text-body text-primary dark:text-primary-dark">
          {memory.fact}
        </Text>
        <View
          className="bg-peach-light dark:bg-peach-light-dark"
          style={{
            alignSelf: "flex-start",
            borderRadius: 8,
            paddingVertical: 2,
            paddingHorizontal: 8,
          }}
        >
          <Text
            className="font-poppins-medium text-tertiary dark:text-tertiary-dark"
            style={{ fontSize: 11 }}
          >
            {categoryLabel}
          </Text>
        </View>
      </View>
      <Pressable onPress={onDelete} hitSlop={12} style={{ padding: 4 }}>
        <Trash2 size={18} color={accentRed} />
      </Pressable>
    </View>
  );
});

export function MemoryManager({ onBack }: MemoryManagerProps) {
  const { t } = useTranslation();
  const memories = useUserMemoriesQuery().data ?? [];
  const deleteMemory = useDeleteUserMemoryMutation();

  const handleDelete = useCallback(
    (id: UserMemoryId) => {
      deleteMemory.mutate(id);
    },
    [deleteMemory]
  );

  const renderItem = useCallback(
    ({ item }: { item: UserMemory }) => (
      <MemoryCard memory={item} onDelete={() => handleDelete(item.id)} />
    ),
    [handleDelete]
  );

  return (
    <ScreenLayout title={t("aiChat.memories")} variant="sub" onBack={onBack}>
      <FlashList
        data={memories}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingBottom: TAB_BAR_CLEARANCE,
          paddingHorizontal: 16,
        }}
        ItemSeparatorComponent={ItemSeparator}
        ListHeaderComponent={
          <View style={{ paddingBottom: 16 }}>
            <Text className="font-poppins-medium text-label text-tertiary dark:text-tertiary-dark leading-relaxed">
              {t("aiChat.memoriesDescription")}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 60, gap: 8 }}>
            <Text className="font-poppins-medium text-body text-tertiary dark:text-tertiary-dark text-center">
              {t("aiChat.noMemories")}
            </Text>
            <Text className="font-poppins-medium text-label text-tertiary dark:text-tertiary-dark text-center">
              {t("aiChat.noMemoriesHint")}
            </Text>
          </View>
        }
      />
    </ScreenLayout>
  );
}
