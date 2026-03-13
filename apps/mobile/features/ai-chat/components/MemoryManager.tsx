import { FlashList } from "@shopify/flash-list";
import { Trash2 } from "lucide-react-native";
import { memo, useCallback, useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { ScreenLayout, TAB_BAR_CLEARANCE } from "@/shared/components/ScreenLayout";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import type { UserMemory } from "../schema";
import { useChatStore } from "../store";

type MemoryManagerProps = {
  readonly onBack: () => void;
};

const CATEGORY_LABELS: Record<string, string> = {
  habit: "Habit",
  preference: "Preference",
  situation: "Situation",
  goal: "Goal",
};

const ItemSeparator = () => <View style={{ height: 8 }} />;

const MemoryCard = memo(function MemoryCardInner({
  memory,
  onDelete,
}: {
  readonly memory: UserMemory;
  readonly onDelete: () => void;
}) {
  const accentRed = useThemeColor("accentRed");

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
            {CATEGORY_LABELS[memory.category] ?? memory.category}
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
  const memories = useChatStore((s) => s.memories);
  const loadMemories = useChatStore((s) => s.loadMemories);
  const deleteMemory = useChatStore((s) => s.deleteMemory);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  const handleDelete = useCallback(
    (id: string) => {
      deleteMemory(id);
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
    <ScreenLayout title="Memories" variant="sub" onBack={onBack}>
      <FlashList
        data={memories}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        estimatedItemSize={80}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingBottom: TAB_BAR_CLEARANCE,
          paddingHorizontal: 16,
        }}
        ItemSeparatorComponent={ItemSeparator}
        ListHeaderComponent={
          <View style={{ paddingBottom: 16 }}>
            <Text className="font-poppins-medium text-label text-tertiary dark:text-tertiary-dark leading-relaxed">
              Things Fidy AI remembers about you. Delete any memory you'd like it to forget.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 60, gap: 8 }}>
            <Text className="font-poppins-medium text-body text-tertiary dark:text-tertiary-dark text-center">
              No memories yet
            </Text>
            <Text className="font-poppins-medium text-label text-tertiary dark:text-tertiary-dark text-center">
              Fidy AI will learn about you as you chat
            </Text>
          </View>
        }
      />
    </ScreenLayout>
  );
}
