import type { ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppAuroraBackground, FidyNumpad } from "@/shared/components";
import { ScrollView, Text, View } from "@/shared/components/rn";
import { useColorScheme, useThemeColor } from "@/shared/hooks";
import { styles } from "./GoalForm.styles";

type GoalFormFrameProps = {
  readonly children: ReactNode;
  readonly fullScreen?: boolean;
  readonly numpadEnabled: boolean;
  readonly onKeyPress: (key: string) => void;
  readonly title: string;
};

export function GoalFormFrame({
  children,
  fullScreen = false,
  numpadEnabled,
  onKeyPress,
  title,
}: GoalFormFrameProps) {
  const card = useThemeColor("card");
  const page = useThemeColor("page");
  const primary = useThemeColor("primary");
  const border = useThemeColor("borderSubtle");
  const isDark = useColorScheme() === "dark";
  const { bottom, top } = useSafeAreaInsets();
  const content = (
    <>
      <Text
        style={[styles.title, fullScreen ? styles.fullScreenTitle : undefined, { color: primary }]}
      >
        {title}
      </Text>
      <View
        style={[
          fullScreen ? styles.fullScreenForm : styles.formCard,
          fullScreen ? undefined : { backgroundColor: card, borderColor: border },
        ]}
      >
        {children}
      </View>
      {numpadEnabled ? <FidyNumpad compact={fullScreen} onKeyPress={onKeyPress} /> : null}
    </>
  );

  if (fullScreen) {
    return (
      <View style={[styles.fullScreenShell, { backgroundColor: page }]}>
        <AppAuroraBackground isDark={isDark} />
        <ScrollView
          style={styles.fullScreenScroller}
          contentContainerStyle={[
            styles.fullScreenContainer,
            { paddingBottom: bottom + 12, paddingTop: top + 72 },
          ]}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: card }]}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: bottom + 24 }]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      {content}
    </ScrollView>
  );
}
