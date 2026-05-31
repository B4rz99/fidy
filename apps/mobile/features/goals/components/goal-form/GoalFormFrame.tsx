import type { ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FidyNumpad, NumpadFormScreen } from "@/shared/components";
import { ScrollView, Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { styles } from "./GoalForm.styles";

type GoalFormFrameProps = {
  readonly children: ReactNode;
  readonly actionContent?: ReactNode;
  readonly amountContent?: ReactNode;
  readonly detailContent?: ReactNode;
  readonly fullScreen?: boolean;
  readonly numpadEnabled: boolean;
  readonly onKeyPress: (key: string) => void;
  readonly title: string;
  readonly topContent?: ReactNode;
};

export function GoalFormFrame({
  actionContent,
  amountContent,
  children,
  detailContent,
  fullScreen = false,
  numpadEnabled,
  onKeyPress,
  title,
  topContent,
}: GoalFormFrameProps) {
  const card = useThemeColor("card");
  const primary = useThemeColor("primary");
  const border = useThemeColor("borderSubtle");
  const { bottom } = useSafeAreaInsets();
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
      {!fullScreen && numpadEnabled ? <FidyNumpad onKeyPress={onKeyPress} /> : null}
    </>
  );

  if (fullScreen) {
    return (
      <NumpadFormScreen
        contentStyle={styles.fullScreenContainer}
        footer={
          detailContent || actionContent ? (
            <View style={styles.fullScreenBottomForm}>
              {detailContent}
              {actionContent}
            </View>
          ) : null
        }
        middle={amountContent}
        middleStyle={styles.fullScreenAmount}
        numpadVisible={numpadEnabled}
        onKeyPress={onKeyPress}
      >
        {topContent}
      </NumpadFormScreen>
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
