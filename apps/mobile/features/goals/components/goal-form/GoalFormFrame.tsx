import type { ReactNode } from "react";
import { MoneyEntryScreen } from "@/shared/components";
import { styles } from "./GoalForm.styles";

type GoalFormFrameProps = {
  readonly actionContent?: ReactNode;
  readonly amountContent?: ReactNode;
  readonly detailContent?: ReactNode;
  readonly headerTitle: string;
  readonly numpadEnabled: boolean;
  readonly onBack?: () => void;
  readonly onKeyPress: (key: string) => void;
  readonly topContent?: ReactNode;
};

export function GoalFormFrame({
  actionContent,
  amountContent,
  detailContent,
  headerTitle,
  numpadEnabled,
  onBack,
  onKeyPress,
  topContent,
}: GoalFormFrameProps) {
  return (
    <MoneyEntryScreen
      actionContent={actionContent}
      amountContent={amountContent ?? null}
      detailContent={detailContent}
      headerTitle={headerTitle}
      amountStyle={styles.fullScreenAmount}
      contentStyle={styles.fullScreenContainer}
      numpadVisible={numpadEnabled}
      onBack={onBack}
      onKeyPress={onKeyPress}
      stackStyle={styles.fullScreenBottomForm}
      topContent={topContent}
    >
      {null}
    </MoneyEntryScreen>
  );
}
