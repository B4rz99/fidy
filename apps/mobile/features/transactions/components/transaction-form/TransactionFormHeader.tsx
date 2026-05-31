import type { ComponentProps } from "react";
import Animated from "react-native-reanimated";
import { MoneyAmountDisplay } from "@/shared/components";
import { X } from "@/shared/components/icons";
import { Pressable, View } from "@/shared/components/rn";
import type { TransactionType } from "../../schema";
import { TypeToggle } from "../TypeToggle";
import { styles } from "./TransactionForm.styles";

type TransactionFormHeaderProps = {
  readonly amountColor: string;
  readonly closeLabel: string;
  readonly cursorStyle: ComponentProps<typeof Animated.View>["style"];
  readonly descriptionFocused: boolean;
  readonly digits: string;
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
  digits,
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
        <MoneyAmountDisplay
          color={amountColor}
          cursorStyle={cursorStyle}
          cursorVisible={!descriptionFocused}
          digits={digits}
          size="hero"
        />
      </View>
    </>
  );
}
