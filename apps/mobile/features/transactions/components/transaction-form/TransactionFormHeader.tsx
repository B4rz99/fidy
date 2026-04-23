import Animated from "react-native-reanimated";
import { X } from "@/shared/components/icons";
import { Pressable, Text, View } from "@/shared/components/rn";
import type { TransactionType } from "../../schema";
import { TypeToggle } from "../TypeToggle";
import { styles } from "./TransactionForm.styles";

type TransactionFormHeaderProps = {
  readonly amountColor: string;
  readonly closeLabel: string;
  readonly cursorStyle: Record<string, unknown>;
  readonly descriptionFocused: boolean;
  readonly displayAmount: string;
  readonly onClose?: () => void;
  readonly onTypeChange: (type: TransactionType) => void;
  readonly secondaryColor: string;
  readonly type: TransactionType;
};

export function TransactionFormHeader({
  amountColor,
  closeLabel,
  cursorStyle,
  descriptionFocused,
  displayAmount,
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
        <View style={styles.amountRow}>
          <Text style={[styles.amountDisplay, { color: amountColor }]}>{displayAmount}</Text>
          {descriptionFocused ? null : (
            <Animated.View
              style={[styles.amountCursor, { backgroundColor: amountColor }, cursorStyle]}
            />
          )}
        </View>
      </View>
    </>
  );
}
