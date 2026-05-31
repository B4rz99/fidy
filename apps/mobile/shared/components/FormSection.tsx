import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type FormSectionProps = {
  readonly children: ReactNode;
  readonly optionalLabel?: string;
  readonly style?: StyleProp<ViewStyle>;
  readonly title: string;
};

export function FormSection({ children, optionalLabel, style, title }: FormSectionProps) {
  const secondary = useThemeColor("secondary");
  const card = useThemeColor("card");
  const borderSubtle = useThemeColor("borderSubtle");

  return (
    <View
      style={[
        {
          borderWidth: 1,
          borderRadius: 8,
          borderCurve: "continuous" as const,
          padding: 16,
          gap: 14,
          backgroundColor: card,
          borderColor: borderSubtle,
          boxShadow: "0 12px 20px rgba(0,0,0,0.18)",
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
    </View>
  );
}
