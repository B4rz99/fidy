import type { ReactNode } from "react";
import { NumpadActionFooter } from "@/shared/components";

type TransactionActionSectionProps = {
  readonly canSave: boolean;
  readonly deleteLabel: string;
  readonly extraActionLabel?: string;
  readonly handleKey: (key: string) => void;
  readonly isSaving: boolean;
  readonly onDelete?: () => void;
  readonly onExtraAction?: () => void;
  readonly onSave: () => void;
  readonly safeBottom: number;
  readonly saveLabel: string;
  readonly topContent?: ReactNode;
};

export function TransactionActionSection({
  canSave,
  deleteLabel,
  extraActionLabel,
  handleKey,
  isSaving,
  onDelete,
  onExtraAction,
  onSave,
  safeBottom,
  saveLabel,
  topContent,
}: TransactionActionSectionProps) {
  return (
    <NumpadActionFooter
      dangerAction={
        onDelete
          ? {
              testID: "transaction-form.delete",
              label: deleteLabel,
              className: "flex-1",
              variant: "danger",
              onPress: onDelete,
            }
          : undefined
      }
      extraAction={
        extraActionLabel && onExtraAction
          ? {
              testID: "transaction-form.extra-action",
              label: extraActionLabel,
              variant: "secondary",
              onPress: onExtraAction,
            }
          : undefined
      }
      onKeyPress={handleKey}
      primaryAction={{
        testID: "transaction-form.save",
        label: saveLabel,
        className: "flex-1",
        onPress: canSave ? onSave : undefined,
        disabled: !canSave || isSaving,
        loading: isSaving,
      }}
      safeBottom={safeBottom}
      topContent={topContent}
    />
  );
}
