import type { ReactNode } from "react";
import { GlassSurface } from "@/shared/components/GlassSurface";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";

// biome-ignore lint/style/useNamingConvention: OAuth is a proper noun
interface OAuthButtonProps {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  containerClassName: string;
  useGlassSurface?: boolean;
  textClassName: string;
  // biome-ignore lint/style/useNamingConvention: React Native prop name
  testID?: string;
}

// biome-ignore lint/style/useNamingConvention: OAuth is a proper noun
export function OAuthButton({
  icon,
  label,
  onPress,
  containerClassName,
  useGlassSurface = false,
  textClassName,
  testID,
}: OAuthButtonProps) {
  const content = (
    <View className="flex-row items-center justify-center gap-3">
      <View style={{ width: 20, height: 20, alignItems: "center", justifyContent: "center" }}>
        {icon}
      </View>
      <Text className={`font-poppins-semibold text-section ${textClassName}`}>{label}</Text>
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      className={`h-[52px] items-center justify-center ${useGlassSurface ? "" : "rounded-xl"} ${containerClassName}`}
    >
      {useGlassSurface ? (
        <GlassSurface padded={false} radius={12} style={styles.glassContent}>
          {content}
        </GlassSurface>
      ) : (
        content
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glassContent: {
    alignItems: "center",
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
});
