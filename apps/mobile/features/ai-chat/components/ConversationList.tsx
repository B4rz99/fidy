import { FlashList } from "@shopify/flash-list";
import { format } from "date-fns";
import { MessageSquare, Plus, Trash2 } from "lucide-react-native";
import { memo, useCallback, useEffect } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import type { ChatSession } from "../schema";
import { useChatStore } from "../store";
import { ExpiredSessionsBanner } from "./ExpiredSessionsBanner";

type ConversationListProps = {
  readonly onSelectSession: (id: string) => void;
  readonly onNewChat: () => void;
  readonly onOpenMemories: () => void;
};

const ItemSeparator = () => <View style={{ height: 10 }} />;

const SessionCard = memo(function SessionCardInner({
  session,
  onSelect,
  onDelete,
}: {
  readonly session: ChatSession;
  readonly onSelect: () => void;
  readonly onDelete: () => void;
}) {
  const tertiary = useThemeColor("tertiary");
  const accentRed = useThemeColor("accentRed");

  const dateStr = format(new Date(session.createdAt), "MMM d, yyyy");

  return (
    <Pressable
      onPress={onSelect}
      className="bg-card dark:bg-card-dark"
      style={{
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <MessageSquare size={20} color={tertiary} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          className="font-poppins-semibold text-body text-primary dark:text-primary-dark"
          numberOfLines={1}
        >
          {session.title}
        </Text>
        <Text className="font-poppins-medium text-caption text-tertiary dark:text-tertiary-dark">
          {dateStr}
        </Text>
      </View>
      <Pressable onPress={() => onDelete()} hitSlop={12} style={{ padding: 4 }}>
        <Trash2 size={18} color={accentRed} />
      </Pressable>
    </Pressable>
  );
});

export function ConversationList({
  onSelectSession,
  onNewChat,
  onOpenMemories,
}: ConversationListProps) {
  const insets = useSafeAreaInsets();
  const sessions = useChatStore((s) => s.sessions);
  const loadSessions = useChatStore((s) => s.loadSessions);
  const deleteSession = useChatStore((s) => s.deleteSession);

  const accentGreen = useThemeColor("accentGreen");

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleDelete = useCallback(
    (id: string) => {
      deleteSession(id);
    },
    [deleteSession]
  );

  const renderItem = useCallback(
    ({ item }: { item: ChatSession }) => (
      <SessionCard
        session={item}
        onSelect={() => onSelectSession(item.id)}
        onDelete={() => handleDelete(item.id)}
      />
    ),
    [onSelectSession, handleDelete]
  );

  return (
    <View className="flex-1 bg-page dark:bg-page-dark">
      <FlashList
        data={sessions}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        estimatedItemSize={72}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingTop: Platform.OS === "android" ? insets.top : 0,
          paddingBottom: 100,
          paddingHorizontal: 20,
        }}
        ItemSeparatorComponent={ItemSeparator}
        ListHeaderComponent={
          <View style={{ paddingBottom: 16, gap: 12 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text className="font-poppins-bold text-logo text-primary dark:text-primary-dark">
                AI Chat
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Pressable
                  onPress={onOpenMemories}
                  className="bg-peach-light dark:bg-peach-light-dark"
                  style={{
                    borderRadius: 16,
                    paddingVertical: 6,
                    paddingHorizontal: 14,
                  }}
                >
                  <Text className="font-poppins-semibold text-label" style={{ color: accentGreen }}>
                    Memories
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onNewChat}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: accentGreen,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Plus size={18} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
            <ExpiredSessionsBanner />
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 60, gap: 8 }}>
            <Text className="font-poppins-medium text-body text-tertiary dark:text-tertiary-dark text-center">
              No conversations yet
            </Text>
            <Text className="font-poppins-medium text-label text-tertiary dark:text-tertiary-dark text-center">
              Tap + to start a new chat
            </Text>
          </View>
        }
      />
    </View>
  );
}
