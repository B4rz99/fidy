import { memo } from "react";
import { CircleCheck, Sparkles } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import type { ChatMessageId } from "@/shared/types/branded";
import { getAssistantDisplayBlocks, getPlainMessageText } from "../lib/message-content";
import type { ChatMessage } from "../schema";
import { ActionCard } from "./ActionCard";

type MessageBubbleProps = {
  readonly message: ChatMessage;
  readonly onConfirmAction?: (messageId: ChatMessageId) => void;
  readonly onDismissAction?: (messageId: ChatMessageId) => void;
};

function MessageBubbleInner({ message, onConfirmAction, onDismissAction }: MessageBubbleProps) {
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const chatAssistantBubble = useThemeColor("chatAssistantBubble");
  const chatAssistantText = useThemeColor("chatAssistantText");
  const chatUserBubble = useThemeColor("chatUserBubble");
  const chatUserText = useThemeColor("chatUserText");

  const isUser = message.role === "user";

  const contentWithoutAction = getPlainMessageText(message.content);
  const assistantBlocks = isUser ? [] : getAssistantDisplayBlocks(message.content);

  return (
    <View style={{ marginBottom: 4 }}>
      {isUser ? (
        <View style={{ alignItems: "flex-end" }}>
          <View
            style={{
              maxWidth: "85%",
              backgroundColor: chatUserBubble,
              borderRadius: 16,
              borderBottomRightRadius: 4,
              paddingVertical: 10,
              paddingHorizontal: 14,
            }}
          >
            <Text className="font-poppins-medium text-body" style={{ color: chatUserText }}>
              {contentWithoutAction}
            </Text>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: chatAssistantBubble,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Sparkles size={16} color={accentGreen} />
          </View>
          <View style={{ flex: 1 }}>
            <View
              style={{
                maxWidth: "90%",
                borderRadius: 16,
                borderBottomLeftRadius: 4,
                backgroundColor: chatAssistantBubble,
                paddingVertical: 10,
                paddingHorizontal: 14,
              }}
            >
              {assistantBlocks.map((block) =>
                block.type === "bullet" ? (
                  <View key={block.key} style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
                    <Text
                      className="font-poppins-medium text-body"
                      style={{ color: chatAssistantText }}
                    >
                      -
                    </Text>
                    <Text
                      className="font-poppins-medium text-body"
                      style={{ color: chatAssistantText, flex: 1 }}
                    >
                      {block.text}
                    </Text>
                  </View>
                ) : (
                  <Text
                    key={block.key}
                    className="font-poppins-medium text-body"
                    style={{ color: chatAssistantText, marginBottom: 4 }}
                  >
                    {block.segments.map((segment) => (
                      <Text
                        key={segment.key}
                        className={
                          segment.strong
                            ? "font-poppins-semibold text-body"
                            : "font-poppins-medium text-body"
                        }
                        style={{ color: chatAssistantText }}
                      >
                        {segment.text}
                      </Text>
                    ))}
                  </Text>
                )
              )}
            </View>
          </View>
        </View>
      )}

      {message.action && message.actionStatus === "confirmed" && message.action.type === "add" && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingLeft: 36,
            marginTop: 4,
          }}
        >
          <CircleCheck size={14} color={accentGreen} />
          <Text className="font-poppins-semibold text-caption" style={{ color: accentGreen }}>
            Added
          </Text>
        </View>
      )}

      {message.action && message.actionStatus === "pending" && message.action.type === "delete" && (
        <View style={{ paddingLeft: 36, marginTop: 8 }}>
          <ActionCard
            action={message.action}
            onConfirm={() => onConfirmAction?.(message.id)}
            onDismiss={() => onDismissAction?.(message.id)}
          />
        </View>
      )}

      {message.action &&
        message.actionStatus === "confirmed" &&
        message.action.type === "delete" && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingLeft: 36,
              marginTop: 4,
            }}
          >
            <CircleCheck size={14} color={accentRed} />
            <Text className="font-poppins-semibold text-caption" style={{ color: accentRed }}>
              Deleted
            </Text>
          </View>
        )}

      {message.action && message.actionStatus === "dismissed" && (
        <View style={{ paddingLeft: 36, marginTop: 4 }}>
          <Text className="font-poppins-medium text-caption text-tertiary dark:text-tertiary-dark">
            Dismissed
          </Text>
        </View>
      )}
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleInner);
