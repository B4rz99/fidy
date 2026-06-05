import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { GlassSurface } from "./GlassSurface";

type FormSectionProps = {
  readonly children: ReactNode;
  readonly optionalLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly title: string;
};

export function FormSection({ children, optionalLabel, style, title }: FormSectionProps) {
  const secondary = useThemeColor("secondary");

  return (
    <GlassSurface
      radius={8}
      style={[
        {
          padding: 16,
          gap: 14,
          shadowColor: "#000000",
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.18,
          shadowRadius: 20,
          elevation: 8,
        },
        style,
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          style={{
            color: secondary,
            fontFamily: "Poppins_800ExtraBold",
            fontSize: 12,
            letterSpacing: 0.8,
            textTransform: "uppercase",
          }}
        >
          {title}
        </Text>
        {optionalLabel ? (
          <Text
            style={{
              color: secondary,
              fontFamily: "Poppins_800ExtraBold",
              fontSize: 12,
            }}
          >
            {optionalLabel}
          </Text>
        ) : null}
      </View>
      {children}
    </GlassSurface>
  );
}
