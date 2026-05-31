import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type FormScreenProps = {
  readonly children: ReactNode;
  readonly contentContainerStyle?: StyleProp<ViewStyle>;
  readonly horizontalPadding?: number;
  readonly keyboardDismissMode?: "none" | "interactive" | "on-drag";
  readonly topPadding?: number;
};

export function FormScreen({
  children,
  contentContainerStyle,
  horizontalPadding = 20,
  keyboardDismissMode,
  topPadding = 0,
}: FormScreenProps) {
  const { bottom } = useSafeAreaInsets();
  const page = useThemeColor("page");

  return (
    <ScrollView
      style={{ backgroundColor: page }}
      contentContainerStyle={[
        {
          paddingHorizontal: horizontalPadding,
          paddingTop: topPadding,
          gap: 12,
        },
        contentContainerStyle,
        { paddingBottom: bottom + 32 },
      ]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode={keyboardDismissMode}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}
