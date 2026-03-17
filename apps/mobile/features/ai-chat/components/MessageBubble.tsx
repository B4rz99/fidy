import { memo } from "react";
import { CircleCheck, Sparkles } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { ACTION_BLOCK_REGEX } from "../lib/parse-action";
import type { ChatMessage } from "../schema";
import { ActionCard } from "./ActionCard";

type MessageBubbleProps = {
  readonly message: ChatMessage;
  readonly onConfirmAction?: (messageId: string) => void;
  readonly onDismissAction?: (messageId: string) => void;
};

function MessageBubbleInner({ message, onConfirmAction, onDismissAction }: MessageBubbleProps) {
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");

  const isUser = message.role === "user";

  const contentWithoutAction = message.content.replace(ACTION_BLOCK_REGEX, "").trim();

  return (
    <View style={{ marginBottom: 4 }}>
      {isUser ? (
        <View style={{ alignItems: "flex-end" }}>
          <View
            style={{
              maxWidth: "85%",
              backgroundColor: accentGreen,
              borderRadius: 16,
              borderBottomRightRadius: 4,
              paddingVertical: 10,
              paddingHorizontal: 14,
            }}
          >
            <Text className="font-poppins-medium text-body" style={{ color: "#FFFFFF" }}>
              {contentWithoutAction}
            </Text>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
          <View
            className="bg-nav dark:bg-nav-dark"
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Sparkles size={16} color={accentGreen} />
          </View>
          <View style={{ flex: 1 }}>
            <View
              className="bg-nav dark:bg-nav-dark"
              style={{
                maxWidth: "90%",
                borderRadius: 16,
                borderBottomLeftRadius: 4,
                paddingVertical: 10,
                paddingHorizontal: 14,
              }}
            >
              <Text className="font-poppins-medium text-body text-primary dark:text-primary-dark">
                {contentWithoutAction}
              </Text>
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
