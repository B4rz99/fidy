import { memo } from "react";
import { Sparkles } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type StreamingBubbleProps = {
  readonly content: string;
};

function StreamingBubbleInner({ content }: StreamingBubbleProps) {
  const accentGreen = useThemeColor("accentGreen");

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
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
            {content || "..."}
          </Text>
        </View>
      </View>
    </View>
  );
}

export const StreamingBubble = memo(StreamingBubbleInner);
