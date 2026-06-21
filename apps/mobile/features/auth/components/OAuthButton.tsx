import type { ReactNode } from "react";
import { SurfacePressable } from "@/shared/components/SurfacePressable";
import { StyleSheet, Text, View } from "@/shared/components/rn";

// biome-ignore lint/style/useNamingConvention: OAuth is a proper noun
interface OAuthButtonProps {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  containerClassName?: string;
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
    <SurfacePressable
      onPress={onPress}
      testID={testID}
      radius={12}
      className={`h-[52px] items-center justify-center ${containerClassName ?? ""}`}
      layoutStyle={styles.surfaceContent}
    >
      {content}
    </SurfacePressable>
  );
}

const styles = StyleSheet.create({
  surfaceContent: {
    alignItems: "center",
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
});
