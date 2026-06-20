import * as Haptics from "expo-haptics";
import { SurfacePressable, SegmentedControl } from "@/shared/components";
import { X } from "@/shared/components/icons";
import { View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import { styles } from "./TransactionForm.styles";
import type { TransactionFormMode } from "./TransactionForm.types";

type TransactionFormHeaderProps = {
  readonly closeLabel: string;
  readonly mode: TransactionFormMode;
  readonly onClose?: () => void;
  readonly onModeChange: (mode: TransactionFormMode) => void;
  readonly secondaryColor: string;
  readonly transferLabel: string;
};

export function TransactionFormHeader({
  closeLabel,
  mode,
  onClose,
  onModeChange,
  secondaryColor,
  transferLabel,
}: TransactionFormHeaderProps) {
  const { t } = useTranslation();
  const handleTabChange = (tab: TransactionFormMode) => {
    void Haptics.selectionAsync();
    onModeChange(tab);
  };

  return (
    <>
      {onClose ? (
        <View style={styles.closeButtonContainer}>
          <SurfacePressable
            onPress={onClose}
            hitSlop={12}
            testID="transaction-form.close"
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
            radius={18}
            padded={false}
            layoutStyle={styles.closeButton}
          >
            <X size={24} color={secondaryColor} />
          </SurfacePressable>
        </View>
      ) : null}

      <View style={styles.headerCenter}>
        <SegmentedControl
          options={[
            { value: "expense", label: t("transactions.expense") },
            { value: "income", label: t("transactions.income") },
            { value: "transfer", label: transferLabel },
          ]}
          value={mode}
          onChange={handleTabChange}
          variant="detached"
          style={styles.typeTabs}
        />
      </View>
    </>
  );
}
