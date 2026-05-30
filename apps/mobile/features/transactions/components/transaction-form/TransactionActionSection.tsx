import { Button, FidyNumpad } from "@/shared/components";
import { Platform, View } from "@/shared/components/rn";
import { styles } from "./TransactionForm.styles";

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
}: TransactionActionSectionProps) {
  return (
    <View style={[styles.bottomZone, { paddingBottom: Platform.OS === "ios" ? safeBottom : 16 }]}>
      {extraActionLabel && onExtraAction ? (
        <Button
          testID="transaction-form.extra-action"
          label={extraActionLabel}
          variant="secondary"
          size="compact"
          className="h-11"
          onPress={onExtraAction}
          accessibilityRole="button"
          accessibilityLabel={extraActionLabel}
        />
      ) : null}

      <View style={styles.actionRow}>
        {onDelete ? (
          <Button
            testID="transaction-form.delete"
            label={deleteLabel}
            variant="danger"
            size="compact"
            className="px-5"
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel={deleteLabel}
          />
        ) : null}
        <Button
          testID="transaction-form.save"
          label={saveLabel}
          className="flex-1"
          onPress={canSave ? onSave : undefined}
          disabled={!canSave || isSaving}
          loading={isSaving}
          accessibilityRole="button"
          accessibilityLabel={saveLabel}
        />
      </View>

      <FidyNumpad onKeyPress={handleKey} />
    </View>
  );
}
