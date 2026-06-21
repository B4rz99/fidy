import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { NumpadFormScreen } from "./NumpadFormScreen";
import { PinnedFormStack } from "./PinnedFormStack";

type MoneyEntryScreenProps = {
  readonly actionContent?: ReactNode;
  readonly amountContent: ReactNode;
  readonly amountStyle?: StyleProp<ViewStyle>;
  readonly children?: ReactNode;
  readonly contentStyle?: StyleProp<ViewStyle>;
  readonly detailContent?: ReactNode;
  readonly footerContent?: ReactNode;
  readonly footerStyle?: StyleProp<ViewStyle>;
  readonly headerTitle?: string;
  readonly numpadVisible?: boolean;
  readonly onBack?: () => void;
  readonly onKeyPress: (key: string) => void;
  readonly stackStyle?: StyleProp<ViewStyle>;
  readonly topContent?: ReactNode;
};

export function MoneyEntryScreen({
  actionContent,
  amountContent,
  amountStyle,
  children,
  contentStyle,
  detailContent,
  footerContent,
  footerStyle,
  headerTitle,
  numpadVisible = true,
  onBack,
  onKeyPress,
  stackStyle,
  topContent,
}: MoneyEntryScreenProps) {
  const footer =
    footerContent ??
    (detailContent || actionContent ? (
      <PinnedFormStack style={stackStyle}>
        {detailContent}
        {actionContent}
      </PinnedFormStack>
    ) : null);

  return (
    <NumpadFormScreen
      contentStyle={contentStyle}
      footer={footer}
      footerStyle={footerStyle}
      headerTitle={headerTitle}
      middle={amountContent}
      middleStyle={amountStyle}
      numpadVisible={numpadVisible}
      onBack={onBack}
      onKeyPress={onKeyPress}
    >
      {topContent}
      {children}
    </NumpadFormScreen>
  );
}

export type { MoneyEntryScreenProps };
