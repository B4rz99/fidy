import { format } from "date-fns";
import { memo, useCallback, useMemo } from "react";
import { useOptionalUserId } from "@/features/auth/public";
import {
  FeedList,
  IconActionButton,
  ListRowSurface,
  ScreenLayout,
  TAB_BAR_CLEARANCE,
} from "@/shared/components";
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
    <ListRowSurface>
      <Pressable
        onPress={() => onSelectSession(session.id)}
        accessibilityRole="button"
        style={styles.sessionMainAction}
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
      </Pressable>
      <IconActionButton
        onPress={() => onDeleteSession(session.id)}
        icon={<Trash2 size={18} color={accentRed} />}
        size="size-8"
      />
    </ListRowSurface>
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
      <FeedList
        data={groupedSessions}
        renderItem={renderItem}
        keyExtractor={sessionKeyExtractor}
        contentContainerStyle={{
          paddingBottom: 0,
          paddingHorizontal: 16,
        }}
        contentInset={{ bottom: TAB_BAR_CLEARANCE }}
        itemSeparatorHeight={10}
        header={
          <View style={{ paddingHorizontal: 4, paddingTop: 20, paddingBottom: 18, gap: 12 }}>
            <Text className="font-poppins-medium text-body" style={{ color: supportTextColor }}>
              {t("aiChat.conversationsSubtitle")}
            </Text>
            {cleanupMessage != null ? (
              <ListRowSurface minHeight={44}>
                <Text
                  className="font-poppins-medium text-label"
                  style={{ color: supportTextColor, flex: 1 }}
                >
                  {cleanupMessage}
                </Text>
                <IconActionButton
                  onPress={dismissCleanup}
                  icon={<X size={16} color={supportTextColor} />}
                  size="size-7"
                />
              </ListRowSurface>
            ) : null}
          </View>
        }
        footer={<AndroidTabBarSpacer />}
      />
    </ScreenLayout>
  );
}

const styles = {
  sessionMainAction: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 12,
  },
} as const;
