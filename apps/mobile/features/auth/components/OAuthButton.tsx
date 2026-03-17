import type { ReactNode } from "react";
import { Pressable, Text, View } from "@/shared/components/rn";

// biome-ignore lint/style/useNamingConvention: OAuth is a proper noun
interface OAuthButtonProps {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  containerClassName: string;
  textClassName: string;
}

// biome-ignore lint/style/useNamingConvention: OAuth is a proper noun
export function OAuthButton({
  icon,
  label,
  onPress,
  containerClassName,
  textClassName,
}: OAuthButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`h-[52px] items-center justify-center rounded-xl ${containerClassName}`}
    >
      <View className="flex-row items-center justify-center gap-3">
        <View style={{ width: 20, height: 20, alignItems: "center", justifyContent: "center" }}>
          {icon}
        </View>
        <Text className={`font-poppins-semibold text-section ${textClassName}`}>{label}</Text>
      </View>
    </Pressable>
  );
}
