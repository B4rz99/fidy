import { memo, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOptionalUserId } from "@/features/auth/public";
import { removeTransaction } from "@/features/transactions/store.public";
import { HEADER_HEIGHT, ScreenLayout } from "@/shared/components";
import { Keyboard, KeyboardAvoidingView, Platform, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useMountEffect, useTranslation } from "@/shared/hooks";
import { captureError, trackAiChatOpened } from "@/shared/lib";
import type { ChatMessageId } from "@/shared/types/branded";
import { useStreamingChat } from "../hooks/use-streaming-chat";
import type { ActionStatus, ChatMessage } from "../schema";
import { updateChatActionStatus, useChatStore } from "../store";
import { ChatConversationShell } from "./ChatConversationShell";
import { ChatInput } from "./ChatInput";
import { MessageBubble } from "./MessageBubble";
import { NewChatButton } from "./NewChatButton";
import { StarterSuggestions } from "./StarterSuggestions";
import { StreamingBubble } from "./StreamingBubble";

type ChatScreenProps = {
  readonly onBack: () => void;
  readonly onNewChat: () => void;
};

const keyExtractor = (item: ChatMessage) => item.id;

const MemoizedMessageBubble = memo(function MemoizedBubble({
  message,
  onConfirm,
  onDismiss,
}: {
  readonly message: ChatMessage;
  readonly onConfirm: (id: ChatMessageId) => void;
  readonly onDismiss: (id: ChatMessageId) => void;
}) {
  return (
    <MessageBubble message={message} onConfirmAction={onConfirm} onDismissAction={onDismiss} />
  );
});

export function ChatScreen({ onBack, onNewChat }: ChatScreenProps) {
  const { t } = useTranslation();
  useMountEffect(() => trackAiChatOpened());
  const userId = useOptionalUserId();
  const { top: safeTop } = useSafeAreaInsets();
  const db = userId ? tryGetDb(userId) : null;

  const messages = useChatStore((s) => s.messages);
  const sessions = useChatStore((s) => s.sessions);
  const currentSessionId = useChatStore((s) => s.currentSessionId);

  const { sendMessage, isStreaming, streamingContent } = useStreamingChat();

  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const title = currentSession?.title ?? t("aiChat.fidyAi");

  const persistActionStatus = useCallback(
    (messageId: ChatMessageId, status: ActionStatus) => {
      if (!db || !userId) return;
      void updateChatActionStatus({ db, userId, messageId, status }).catch(captureError);
    },
    [db, userId]
  );

  const handleConfirmAction = useCallback(
    async (messageId: ChatMessageId) => {
      const msg = messages.find((m) => m.id === messageId);
      if (msg?.action?.type === "delete") {
        try {
          if (!db || !userId) return;
          await removeTransaction(db, userId, msg.action.transactionId);
        } catch {
          persistActionStatus(messageId, "dismissed");
          return;
        }
      }
      persistActionStatus(messageId, "confirmed");
    },
    [db, messages, persistActionStatus, userId]
  );

  const handleDismissAction = useCallback(
    (messageId: ChatMessageId) => {
      persistActionStatus(messageId, "dismissed");
    },
    [persistActionStatus]
  );
  const handleConfirmActionPress = useCallback(
    (messageId: ChatMessageId) => {
      void handleConfirmAction(messageId);
    },
    [handleConfirmAction]
  );

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <MemoizedMessageBubble
        message={item}
        onConfirm={handleConfirmActionPress}
        onDismiss={handleDismissAction}
      />
    ),
    [handleConfirmActionPress, handleDismissAction]
  );

  const handleSend = useCallback(
    (text: string) => {
      void sendMessage(text);
    },
    [sendMessage]
  );

  const handleSuggestionSelect = useCallback(
    (text: string) => {
      handleSend(text);
    },
    [handleSend]
  );

  return (
    <ScreenLayout
      title={title}
      variant="sub"
      onBack={onBack}
      includesNativeHeader={false}
      rightActions={<NewChatButton onPress={onNewChat} />}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? safeTop + HEADER_HEIGHT : HEADER_HEIGHT}
      >
        <ChatConversationShell
          messages={messages}
          renderMessage={renderItem}
          keyExtractor={keyExtractor}
          isStreaming={isStreaming}
          streamingBubble={<StreamingBubble content={streamingContent} />}
          scrollToBottomLabel={t("aiChat.scrollToBottom")}
          composer={<ChatInput onSend={handleSend} disabled={isStreaming} />}
          emptyState={
            <View
              style={{ flex: 1 }}
              onStartShouldSetResponder={() => {
                Keyboard.dismiss();
                return false;
              }}
            >
              <StarterSuggestions onSelect={handleSuggestionSelect} />
            </View>
          }
        />
      </KeyboardAvoidingView>
    </ScreenLayout>
  );
}
