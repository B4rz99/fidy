import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView } from "@/shared/components/rn";
import { ScreenShell } from "./ScreenShell";
import { SolidScreenHeader } from "./SolidScreenHeader";

type FormScreenProps = {
  readonly children: ReactNode;
  readonly contentContainerStyle?: StyleProp<ViewStyle>;
  readonly headerTitle?: string;
  readonly horizontalPadding?: number;
  readonly keyboardDismissMode?: "none" | "interactive" | "on-drag";
  readonly onBack?: () => void;
  readonly topPadding?: number;
};

export function FormScreen({
  children,
  contentContainerStyle,
  headerTitle,
  horizontalPadding = 20,
  keyboardDismissMode,
  onBack,
  topPadding = 0,
}: FormScreenProps) {
  const { bottom } = useSafeAreaInsets();
  const hasHeader = headerTitle != null || onBack != null;

  return (
    <ScreenShell>
      {hasHeader ? <SolidScreenHeader title={headerTitle} onBack={onBack} /> : null}
      <ScrollView
        style={{ backgroundColor: "transparent" }}
        contentContainerStyle={[
          {
            paddingHorizontal: horizontalPadding,
            paddingTop: hasHeader ? topPadding + 12 : topPadding,
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
    </ScreenShell>
  );
}
