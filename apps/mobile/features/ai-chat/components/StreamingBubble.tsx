import { memo } from "react";
import { Sparkles } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type StreamingBubbleProps = {
  readonly content: string;
};

function StreamingBubbleInner({ content }: StreamingBubbleProps) {
  const accentGreen = useThemeColor("accentGreen");
  const chatAssistantBubble = useThemeColor("chatAssistantBubble");
  const chatAssistantText = useThemeColor("chatAssistantText");

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
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
          <Text className="font-poppins-medium text-body" style={{ color: chatAssistantText }}>
            {content || "..."}
          </Text>
        </View>
      </View>
    </View>
  );
}

export const StreamingBubble = memo(StreamingBubbleInner);
