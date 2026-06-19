import { memo, useEffect, useState } from "react";
import { Surface } from "@/shared/components";
import { Sparkles } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getStreamingBubbleDisplay } from "../lib/streaming-bubble-display";

type StreamingBubbleProps = {
  readonly content: string;
};

function ThinkingDots({ color }: { readonly color: string }) {
  const [activeDot, setActiveDot] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActiveDot((dot) => (dot + 1) % 3);
    }, 260);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={{ flexDirection: "row", gap: 4, paddingTop: 2 }}>
      {[0, 1, 2].map((dot) => (
        <View
          key={dot}
          style={{
            width: 5,
            height: 5,
            borderRadius: 2.5,
            backgroundColor: color,
            opacity: dot === activeDot ? 1 : 0.28,
          }}
        />
      ))}
    </View>
  );
}

function StreamingBubbleInner({ content }: StreamingBubbleProps) {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const chatAssistantText = useThemeColor("chatAssistantText");
  const display = getStreamingBubbleDisplay(content, t("aiChat.thinking"));

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
      <Surface
        padded={false}
        radius={14}
        style={{
          width: 28,
          height: 28,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Sparkles size={16} color={accentGreen} />
      </Surface>
      <View style={{ flex: 1 }}>
        <Surface
          padded={false}
          radius={16}
          style={{
            maxWidth: "90%",
            paddingVertical: 10,
            paddingHorizontal: 14,
          }}
        >
          {display.phase === "waiting" ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text className="font-poppins-medium text-body" style={{ color: chatAssistantText }}>
                {display.label}
              </Text>
              <ThinkingDots color={chatAssistantText} />
            </View>
          ) : (
            <Text className="font-poppins-medium text-body" style={{ color: chatAssistantText }}>
              {display.content}
              <Text style={{ color: chatAssistantText, opacity: 0.45 }}> |</Text>
            </Text>
          )}
        </Surface>
      </View>
    </View>
  );
}

export const StreamingBubble = memo(StreamingBubbleInner);
