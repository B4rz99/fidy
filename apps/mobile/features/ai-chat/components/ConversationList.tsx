import { FlashList } from "@shopify/flash-list";
import { format } from "date-fns";
import { memo, useCallback, useMemo } from "react";
import { useOptionalUserId } from "@/features/auth/public";
import { Card, ScreenLayout, TAB_BAR_CLEARANCE } from "@/shared/components";
import { MessageSquare, Trash2, X } from "@/shared/components/icons";
import { Platform, Pressable, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useMountEffect, useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import type { ChatSessionId } from "@/shared/types/branded";
import { useSessionCleanup } from "../hooks/use-session-cleanup";
import { buildGroupedSessions } from "../lib/session-list-items";
import type { ChatSessionListItem } from "../lib/session-list-items";
import type { ChatSession } from "../schema";
import { deleteChatSession, loadChatSessions, useChatStore } from "../store";
import { NewChatButton } from "./NewChatButton";
import { useAiSupportTextColor } from "./use-ai-support-text-color";

type ConversationListProps = {
  readonly onSelectSession: (id: ChatSessionId) => void;
  readonly onNewChat: () => void;
};

const ItemSeparator = () => <View style={{ height: 10 }} />;

const sessionKeyExtractor = (item: ChatSessionListItem) =>
  item.type === "date" ? item.id : item.session.id;

function AndroidTabBarSpacer() {
  return Platform.OS === "ios" ? null : <View style={{ height: TAB_BAR_CLEARANCE }} />;
}

const SessionCard = memo(function SessionCardInner({
  session,
  onDeleteSession,
  onSelectSession,
}: {
  readonly session: ChatSession;
  readonly onDeleteSession: (id: ChatSessionId) => void;
  readonly onSelectSession: (id: ChatSessionId) => void;
}) {
  const { locale } = useTranslation();
  const supportTextColor = useAiSupportTextColor();
  const accentRed = useThemeColor("accentRed");

  const dateStr = format(new Date(session.createdAt), "PP", {
    locale: getDateFnsLocale(locale),
  });

  return (
    <Card
      onPress={() => onSelectSession(session.id)}
      padded={false}
      className="rounded-lg"
      style={{
        paddingVertical: 13,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <MessageSquare size={20} color={supportTextColor} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          className="font-poppins-semibold text-body text-primary dark:text-primary-dark"
          numberOfLines={1}
        >
          {session.title}
        </Text>
        <Text className="font-poppins-medium text-caption" style={{ color: supportTextColor }}>
          {dateStr}
        </Text>
      </View>
      <Pressable onPress={() => onDeleteSession(session.id)} hitSlop={12} style={{ padding: 4 }}>
        <Trash2 size={18} color={accentRed} />
      </Pressable>
    </Card>
  );
});

export function ConversationList({ onSelectSession, onNewChat }: ConversationListProps) {
  const { t, locale } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const sessions = useChatStore((s) => s.sessions);

  const supportTextColor = useAiSupportTextColor();
  const { message: cleanupMessage, dismiss: dismissCleanup } = useSessionCleanup();
  const dateFnsLocale = getDateFnsLocale(locale);
  const groupedSessions = useMemo(
    () => buildGroupedSessions(sessions, dateFnsLocale, t),
    [dateFnsLocale, sessions, t]
  );

  useMountEffect(() => {
    if (!db || !userId) return;
    void loadChatSessions(db, userId);
  });

  const handleDelete = useCallback(
    (id: ChatSessionId) => {
      if (!db || !userId) return;
      void deleteChatSession(db, userId, id);
    },
    [db, userId]
  );

  const renderItem = useCallback(
    ({ item }: { item: ChatSessionListItem }) =>
      item.type === "date" ? (
        <Text
          className="font-poppins-semibold text-caption"
          style={{
            color: supportTextColor,
            paddingTop: 8,
            paddingBottom: 2,
            textTransform: "capitalize",
          }}
        >
          {item.label}
        </Text>
      ) : (
        <SessionCard
          session={item.session}
          onSelectSession={onSelectSession}
          onDeleteSession={handleDelete}
        />
      ),
    [onSelectSession, handleDelete, supportTextColor]
  );

  return (
    <ScreenLayout
      title={t("aiChat.title")}
      includesNativeHeader={false}
      rightActions={<NewChatButton onPress={onNewChat} />}
    >
      <FlashList
        data={groupedSessions}
        renderItem={renderItem}
        keyExtractor={sessionKeyExtractor}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingBottom: 0,
          paddingHorizontal: 16,
        }}
        contentInset={{ bottom: TAB_BAR_CLEARANCE }}
        ItemSeparatorComponent={ItemSeparator}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 4, paddingTop: 20, paddingBottom: 18, gap: 12 }}>
            <Text className="font-poppins-medium text-body" style={{ color: supportTextColor }}>
              {t("aiChat.conversationsSubtitle")}
            </Text>
            {cleanupMessage != null ? (
              <Card
                padded={false}
                className="rounded-xl"
                style={{
                  borderCurve: "continuous",
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Text
                  className="font-poppins-medium text-label"
                  style={{ color: supportTextColor, flex: 1 }}
                >
                  {cleanupMessage}
                </Text>
                <Pressable onPress={dismissCleanup} hitSlop={12} style={{ padding: 2 }}>
                  <X size={16} color={supportTextColor} />
                </Pressable>
              </Card>
            ) : null}
          </View>
        }
        ListFooterComponent={AndroidTabBarSpacer}
      />
    </ScreenLayout>
  );
}
