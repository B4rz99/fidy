import { FidyNumpad } from "@/shared/components";
import { Platform, Pressable, Text, View } from "@/shared/components/rn";
import { styles } from "./TransactionForm.styles";

type TransactionActionSectionProps = {
  readonly borderSubtle: string;
  readonly buttonBackground: string;
  readonly canSave: boolean;
  readonly cardColor: string;
  readonly deleteLabel: string;
  readonly deleteTint: string;
  readonly extraActionLabel?: string;
  readonly handleKey: (key: string) => void;
  readonly isSaving: boolean;
  readonly onDelete?: () => void;
  readonly onExtraAction?: () => void;
  readonly onSave: () => void;
  readonly primaryColor: string;
  readonly safeBottom: number;
  readonly saveLabel: string;
};

export function TransactionActionSection({
  borderSubtle,
  buttonBackground,
  canSave,
  cardColor,
  deleteLabel,
  deleteTint,
  extraActionLabel,
  handleKey,
  isSaving,
  onDelete,
  onExtraAction,
  onSave,
  primaryColor,
  safeBottom,
  saveLabel,
}: TransactionActionSectionProps) {
  return (
    <View style={[styles.bottomZone, { paddingBottom: Platform.OS === "ios" ? safeBottom : 16 }]}>
      {extraActionLabel && onExtraAction ? (
        <Pressable
          testID="transaction-form.extra-action"
          style={[
            styles.extraActionButton,
            { backgroundColor: cardColor, borderColor: borderSubtle },
          ]}
          onPress={onExtraAction}
          accessibilityRole="button"
          accessibilityLabel={extraActionLabel}
        >
          <Text style={[styles.extraActionText, { color: primaryColor }]}>{extraActionLabel}</Text>
        </Pressable>
      ) : null}

      <View style={styles.actionRow}>
        {onDelete ? (
          <Pressable
            testID="transaction-form.delete"
            style={[styles.deleteButton, { backgroundColor: `${deleteTint}18` }]}
            onPress={onDelete}
            accessibilityRole="button"
            accessibilityLabel={deleteLabel}
          >
            <Text style={[styles.deleteButtonText, { color: deleteTint }]}>{deleteLabel}</Text>
          </Pressable>
        ) : null}
        <Pressable
          testID="transaction-form.save"
          style={[
            styles.saveButton,
            { backgroundColor: buttonBackground, opacity: isSaving ? 0.5 : 1 },
          ]}
          onPress={canSave ? onSave : undefined}
          disabled={!canSave || isSaving}
          accessibilityRole="button"
          accessibilityLabel={saveLabel}
        >
          <Text style={styles.actionButtonText}>{saveLabel}</Text>
        </Pressable>
      </View>

      <FidyNumpad onKeyPress={handleKey} />
    </View>
  );
}
