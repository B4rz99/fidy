import { FlashList } from "@shopify/flash-list";
import { format } from "date-fns";
import { MessageSquare, Plus, Trash2, X } from "lucide-react-native";
import { memo, useCallback, useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { ScreenLayout, TAB_BAR_CLEARANCE } from "@/shared/components/ScreenLayout";
import { useThemeColor } from "@/shared/hooks/use-theme-color";
import { useSessionCleanup } from "../hooks/use-session-cleanup";
import type { ChatSession } from "../schema";
import { useChatStore } from "../store";

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

function HeaderActions({
  onOpenMemories,
  onNewChat,
}: {
  readonly onOpenMemories: () => void;
  readonly onNewChat: () => void;
}) {
  const accentGreen = useThemeColor("accentGreen");

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Pressable
        onPress={onOpenMemories}
        className="bg-peach-light dark:bg-peach-light-dark"
        style={{
          borderRadius: 16,
          borderCurve: "continuous",
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
          borderCurve: "continuous",
          backgroundColor: accentGreen,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Plus size={18} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

export function ConversationList({
  onSelectSession,
  onNewChat,
  onOpenMemories,
}: ConversationListProps) {
  const sessions = useChatStore((s) => s.sessions);
  const loadSessions = useChatStore((s) => s.loadSessions);
  const deleteSession = useChatStore((s) => s.deleteSession);

  const tertiary = useThemeColor("tertiary");
  const { message: cleanupMessage, dismiss: dismissCleanup } = useSessionCleanup();

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
    <ScreenLayout
      title="AI Chat"
      rightActions={<HeaderActions onOpenMemories={onOpenMemories} onNewChat={onNewChat} />}
    >
      <FlashList
        data={sessions}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingBottom: TAB_BAR_CLEARANCE,
          paddingHorizontal: 16,
        }}
        ItemSeparatorComponent={ItemSeparator}
        ListHeaderComponent={
          cleanupMessage != null ? (
            <View style={{ paddingBottom: 16 }}>
              <View
                className="bg-card dark:bg-card-dark"
                style={{
                  borderRadius: 12,
                  borderCurve: "continuous",
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Text
                  className="font-poppins-medium text-label text-tertiary dark:text-tertiary-dark"
                  style={{ flex: 1 }}
                >
                  {cleanupMessage}
                </Text>
                <Pressable onPress={dismissCleanup} hitSlop={12} style={{ padding: 2 }}>
                  <X size={16} color={tertiary} />
                </Pressable>
              </View>
            </View>
          ) : null
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
    </ScreenLayout>
  );
}
