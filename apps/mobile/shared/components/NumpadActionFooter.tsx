import type { ComponentProps, ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "@/shared/components/rn";
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

type FooterActionButtonProps = {
  readonly action: FooterAction;
  readonly fallbackClassName?: string;
};

function FooterActionButton({ action, fallbackClassName }: FooterActionButtonProps) {
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
    <View style={[styles.footer, { paddingBottom: Math.max(safeBottom, 16) }, style]}>
      {topContent}
      {extraAction ? <FooterActionButton action={extraAction} fallbackClassName="h-11" /> : null}
      <View style={styles.actionRow}>
        {dangerAction ? (
          <FooterActionButton action={dangerAction} fallbackClassName="px-5" />
        ) : null}
        <FooterActionButton action={primaryAction} fallbackClassName="flex-1" />
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
