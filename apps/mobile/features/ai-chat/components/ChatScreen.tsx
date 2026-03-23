import type { FlashListRef } from "@shopify/flash-list";
import { FlashList } from "@shopify/flash-list";
import { memo, useCallback, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTransactionStore } from "@/features/transactions";
import { HEADER_HEIGHT, ScreenLayout } from "@/shared/components";
import { Keyboard, KeyboardAvoidingView, Platform, View } from "@/shared/components/rn";
import { useMountEffect, useTranslation } from "@/shared/hooks";
import { trackAiChatOpened } from "@/shared/lib";
import type { ChatMessageId } from "@/shared/types/branded";
import { useStreamingChat } from "../hooks/use-streaming-chat";
import type { ChatMessage } from "../schema";
import { useChatStore } from "../store";
import { ChatInput } from "./ChatInput";
import { MessageBubble } from "./MessageBubble";
import { StarterSuggestions } from "./StarterSuggestions";
import { StreamingBubble } from "./StreamingBubble";

type ChatScreenProps = {
  readonly onBack: () => void;
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

export function ChatScreen({ onBack }: ChatScreenProps) {
  const { t } = useTranslation();
  useMountEffect(() => trackAiChatOpened());
  const listRef = useRef<FlashListRef<ChatMessage>>(null);
  const { top: safeTop } = useSafeAreaInsets();

  const messages = useChatStore((s) => s.messages);
  const sessions = useChatStore((s) => s.sessions);
  const currentSessionId = useChatStore((s) => s.currentSessionId);
  const updateActionStatus = useChatStore((s) => s.updateActionStatus);

  const { sendMessage, isStreaming, streamingContent } = useStreamingChat();

  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const title = currentSession?.title ?? t("aiChat.fidyAi");

  const handleConfirmAction = useCallback(
    async (messageId: ChatMessageId) => {
      const msg = messages.find((m) => m.id === messageId);
      if (msg?.action?.type === "delete") {
        try {
          await useTransactionStore.getState().removeTransaction(msg.action.transactionId);
        } catch {
          updateActionStatus(messageId, "dismissed");
          return;
        }
      }
      updateActionStatus(messageId, "confirmed");
    },
    [messages, updateActionStatus]
  );

  const handleDismissAction = useCallback(
    (messageId: ChatMessageId) => {
      updateActionStatus(messageId, "dismissed");
    },
    [updateActionStatus]
  );

  const renderItem = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <MemoizedMessageBubble
        message={item}
        onConfirm={handleConfirmAction}
        onDismiss={handleDismissAction}
      />
    ),
    [handleConfirmAction, handleDismissAction]
  );

  const handleSend = useCallback(
    (text: string) => {
      sendMessage(text);
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    },
    [sendMessage]
  );

  const handleSuggestionSelect = useCallback(
    (text: string) => {
      handleSend(text);
    },
    [handleSend]
  );

  const isEmpty = messages.length === 0 && !isStreaming;

  return (
    <ScreenLayout title={title} variant="sub" onBack={onBack}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? safeTop + 54 : HEADER_HEIGHT}
      >
        {isEmpty ? (
          <View
            style={{ flex: 1 }}
            onStartShouldSetResponder={() => {
              Keyboard.dismiss();
              return false;
            }}
          >
            <StarterSuggestions onSelect={handleSuggestionSelect} />
          </View>
        ) : (
          <FlashList
            ref={listRef}
            data={messages}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 12,
            }}
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              listRef.current?.scrollToEnd({ animated: false });
            }}
            ListFooterComponent={
              isStreaming ? <StreamingBubble content={streamingContent} /> : null
            }
          />
        )}

        <ChatInput onSend={handleSend} disabled={isStreaming} />
      </KeyboardAvoidingView>
    </ScreenLayout>
  );
}
