import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { ScrollView, View } from "@/shared/components/rn";
import { DialogCancelButton, DialogFrame, DialogPanel, DialogTitle } from "./DialogFrame";

type PickerDialogProps = {
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly onClose: () => void;
  readonly showCancel?: boolean;
  readonly showHandle?: boolean;
  readonly subtitle?: ReactNode;
  readonly subtitleStyle?: StyleProp<ViewStyle>;
  readonly testID?: string;
  readonly title: ReactNode;
  readonly visible: boolean;
};

export function PickerDialog({
  children,
  footer,
  onClose,
  showCancel = true,
  showHandle = false,
  subtitle,
  subtitleStyle,
  testID,
  title,
  visible,
}: PickerDialogProps) {
  return (
    <DialogFrame visible={visible} testID={testID} onClose={onClose}>
      <DialogPanel maxHeight="72%" showHandle={showHandle}>
        <View style={{ gap: 4 }}>
          <DialogTitle>{title}</DialogTitle>
          {subtitle ? <View style={subtitleStyle}>{subtitle}</View> : null}
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ gap: 8 }}>{children}</View>
        </ScrollView>
        {footer ?? (showCancel ? <DialogCancelButton onPress={onClose} /> : null)}
      </DialogPanel>
    </DialogFrame>
  );
}

export type { PickerDialogProps };
