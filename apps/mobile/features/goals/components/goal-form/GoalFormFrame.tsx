import type { ReactNode } from "react";
import { MoneyEntryScreen } from "@/shared/components";
import { styles } from "./GoalForm.styles";

type GoalFormFrameProps = {
  readonly actionContent?: ReactNode;
  readonly amountContent?: ReactNode;
  readonly detailContent?: ReactNode;
  readonly numpadEnabled: boolean;
  readonly onKeyPress: (key: string) => void;
  readonly topContent?: ReactNode;
};

export function GoalFormFrame({
  actionContent,
  amountContent,
  detailContent,
  numpadEnabled,
  onKeyPress,
  topContent,
}: GoalFormFrameProps) {
  return (
    <MoneyEntryScreen
      actionContent={actionContent}
      amountContent={amountContent ?? null}
      detailContent={detailContent}
      amountStyle={styles.fullScreenAmount}
      contentStyle={styles.fullScreenContainer}
      numpadVisible={numpadEnabled}
      onKeyPress={onKeyPress}
      stackStyle={styles.fullScreenBottomForm}
      topContent={topContent}
    >
      {null}
    </MoneyEntryScreen>
  );
}
