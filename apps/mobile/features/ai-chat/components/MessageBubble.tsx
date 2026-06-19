import { memo } from "react";
import { GlassSurface } from "@/shared/components/GlassSurface";
import { CircleCheck } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import type { ChatMessageId } from "@/shared/types/branded";
import { getAssistantDisplayBlocks, getPlainMessageText } from "../lib/message-content";
import type { ChatMessage } from "../schema";
import { ActionCard } from "./ActionCard";
import { useAiSupportTextColor } from "./use-ai-support-text-color";

type MessageBubbleProps = {
  readonly message: ChatMessage;
  readonly onConfirmAction?: (messageId: ChatMessageId) => void;
  readonly onDismissAction?: (messageId: ChatMessageId) => void;
};

function MessageBubbleInner({ message, onConfirmAction, onDismissAction }: MessageBubbleProps) {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const supportTextColor = useAiSupportTextColor();
  const chatAssistantText = useThemeColor("chatAssistantText");
  const chatUserText = useThemeColor("chatUserText");

  const isUser = message.role === "user";

  const contentWithoutAction = getPlainMessageText(message.content);
  const assistantBlocks = isUser ? [] : getAssistantDisplayBlocks(message.content);
  const agentIcon = "✦";

  return (
    <View style={{ marginBottom: 10 }}>
      {isUser ? (
        <View style={{ alignItems: "flex-end" }}>
          <GlassSurface
            padded={false}
            radius={18}
            style={{
              maxWidth: "85%",
              borderBottomRightRadius: 6,
              paddingVertical: 12,
              paddingHorizontal: 15,
            }}
          >
            <Text className="font-poppins-medium text-body" style={{ color: chatUserText }}>
              {contentWithoutAction}
            </Text>
          </GlassSurface>
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
          <GlassSurface
            padded={false}
            radius={15}
            style={{
              width: 30,
              height: 30,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text className="font-poppins-semibold text-body" style={{ color: accentGreen }}>
              {agentIcon}
            </Text>
          </GlassSurface>
          <View style={{ flex: 1 }}>
            <GlassSurface
              padded={false}
              radius={18}
              style={{
                maxWidth: "90%",
                borderBottomLeftRadius: 6,
                paddingVertical: 12,
                paddingHorizontal: 15,
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
            </GlassSurface>
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
            {t("aiChat.status.added")}
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
              {t("aiChat.status.deleted")}
            </Text>
          </View>
        )}

      {message.action && message.actionStatus === "dismissed" && (
        <View style={{ paddingLeft: 36, marginTop: 4 }}>
          <Text className="font-poppins-medium text-caption" style={{ color: supportTextColor }}>
            {t("aiChat.status.dismissed")}
          </Text>
        </View>
      )}
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleInner);
