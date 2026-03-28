import { FlashList } from "@shopify/flash-list";
import { format } from "date-fns";
import { Stack } from "expo-router";
import { memo, useCallback } from "react";
import { ScreenLayout, TAB_BAR_CLEARANCE } from "@/shared/components";
import { MessageSquare, Plus, Trash2, X } from "@/shared/components/icons";
import { Platform, Pressable, Text, View } from "@/shared/components/rn";
import { useMountEffect, useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import type { ChatSessionId } from "@/shared/types/branded";
import { useSessionCleanup } from "../hooks/use-session-cleanup";
import type { ChatSession } from "../schema";
import { useChatStore } from "../store";

type ConversationListProps = {
  readonly onSelectSession: (id: ChatSessionId) => void;
  readonly onNewChat: () => void;
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
  const { locale } = useTranslation();
  const tertiary = useThemeColor("tertiary");
  const accentRed = useThemeColor("accentRed");

  const dateStr = format(new Date(session.createdAt), "PP", {
    locale: getDateFnsLocale(locale),
  });

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

function NewChatButton({ onPress }: { readonly onPress: () => void }) {
  const iconColor = useThemeColor("primary");

  return (
    <Pressable onPress={onPress} hitSlop={12}>
      <Plus size={24} color={iconColor} />
    </Pressable>
  );
}

export function ConversationList({ onSelectSession, onNewChat }: ConversationListProps) {
  const { t } = useTranslation();
  const sessions = useChatStore((s) => s.sessions);
  const loadSessions = useChatStore((s) => s.loadSessions);
  const deleteSession = useChatStore((s) => s.deleteSession);

  const tertiary = useThemeColor("tertiary");
  const { message: cleanupMessage, dismiss: dismissCleanup } = useSessionCleanup();

  useMountEffect(() => {
    void loadSessions();
  });

  const handleDelete = useCallback(
    (id: ChatSessionId) => {
      void deleteSession(id);
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
      title={t("aiChat.title")}
      rightActions={Platform.OS !== "ios" ? <NewChatButton onPress={onNewChat} /> : undefined}
    >
      {Platform.OS === "ios" && (
        <Stack.Screen
          options={{
            title: t("aiChat.title"),
            headerLeft: () => null,
            headerRight: () => <NewChatButton onPress={onNewChat} />,
          }}
        />
      )}
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
              {t("aiChat.noConversations")}
            </Text>
            <Text className="font-poppins-medium text-label text-tertiary dark:text-tertiary-dark text-center">
              {t("aiChat.tapToStart")}
            </Text>
          </View>
        }
      />
    </ScreenLayout>
  );
}
