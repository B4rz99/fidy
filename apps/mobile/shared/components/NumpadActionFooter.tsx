import type { ComponentProps, ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Platform, StyleSheet, View } from "@/shared/components/rn";
import { Button } from "./Button";
import { FidyNumpad } from "./FidyNumpad";

type FooterAction = {
  readonly accessibilityLabel?: string;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly label: string;
  readonly loading?: boolean;
  readonly onPress?: () => void;
  readonly testID?: string;
  readonly variant?: ComponentProps<typeof Button>["variant"];
};

type NumpadActionFooterProps = {
  readonly dangerAction?: FooterAction;
  readonly extraAction?: FooterAction;
  readonly numpadVisible?: boolean;
  readonly onKeyPress?: (key: string) => void;
  readonly primaryAction: FooterAction;
  readonly safeBottom?: number;
  readonly style?: StyleProp<ViewStyle>;
  readonly topContent?: ReactNode;
};

function renderAction(action: FooterAction, fallbackClassName?: string) {
  return (
    <Button
      testID={action.testID}
      label={action.label}
      variant={action.variant}
      className={action.className ?? fallbackClassName}
      onPress={action.onPress}
      disabled={action.disabled}
      loading={action.loading}
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel ?? action.label}
    />
  );
}

export function NumpadActionFooter({
  dangerAction,
  extraAction,
  numpadVisible = true,
  onKeyPress,
  primaryAction,
  safeBottom = 16,
  style,
  topContent,
}: NumpadActionFooterProps) {
  return (
    <View
      style={[styles.footer, { paddingBottom: Platform.OS === "ios" ? safeBottom : 16 }, style]}
    >
      {topContent}
      {extraAction ? renderAction(extraAction, "h-11") : null}
      <View style={styles.actionRow}>
        {dangerAction ? renderAction(dangerAction, "px-5") : null}
        {renderAction(primaryAction, "flex-1")}
      </View>
      {numpadVisible && onKeyPress ? <FidyNumpad onKeyPress={onKeyPress} /> : null}
    </View>
  );
}

export type { FooterAction, NumpadActionFooterProps };

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  footer: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
