import { X } from "@/shared/components/icons";
import { Pressable, View } from "@/shared/components/rn";
import type { TransactionType } from "../../schema";
import { TypeToggle } from "../TypeToggle";
import { styles } from "./TransactionForm.styles";

type TransactionFormHeaderProps = {
  readonly closeLabel: string;
  readonly onClose?: () => void;
  readonly onTypeChange: (type: TransactionType) => void;
  readonly secondaryColor: string;
  readonly type: TransactionType;
};

export function TransactionFormHeader({
  closeLabel,
  onClose,
  onTypeChange,
  secondaryColor,
  type,
}: TransactionFormHeaderProps) {
  return (
    <>
      {onClose ? (
        <View style={styles.closeButtonContainer}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            testID="transaction-form.close"
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
          >
            <X size={24} color={secondaryColor} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.headerCenter}>
        <TypeToggle value={type} onChange={onTypeChange} />
      </View>
    </>
  );
}
