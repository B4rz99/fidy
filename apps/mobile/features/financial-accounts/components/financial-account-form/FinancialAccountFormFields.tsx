import type { StyleProp, ViewStyle } from "react-native";
import {
  type FinancialAccountKind,
  financialAccountKindSchema,
} from "@/features/financial-accounts/schema";
import { getKindEmoji } from "@/features/financial-accounts/lib/kind-display";
import { GlassPressable } from "@/shared/components/GlassPressable";
import { SelectableChipRow } from "@/shared/components/SelectableChipRow";
import { Text } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { styles } from "./FinancialAccountForm.styles";

export const ACCOUNT_KIND_OPTIONS = financialAccountKindSchema.options;

export function FinancialAccountKindPicker({
  chipStyle,
  showEmoji = true,
  style,
  value,
  onChange,
}: {
  readonly chipStyle?: StyleProp<ViewStyle>;
  readonly showEmoji?: boolean;
  readonly style?: StyleProp<ViewStyle>;
  readonly value: FinancialAccountKind;
  readonly onChange: (kind: FinancialAccountKind) => void;
}) {
  const { t } = useTranslation();
  const options = ACCOUNT_KIND_OPTIONS.map((kind) => {
    const label = t(`financialAccounts.kinds.${kind}`);

    return {
      value: kind,
      label: showEmoji ? `${getKindEmoji(kind)} ${label}` : label,
    };
  });

  return (
    <SelectableChipRow
      accessibilityLabel={t("financialAccounts.form.kindLabel")}
      accessibilityRole="radiogroup"
      options={options}
      value={value}
      onChange={onChange}
      optionAccessibilityRole="radio"
      selectedTone="primary"
      chipStyle={chipStyle}
      style={style}
    />
  );
}

export function KindChip({
  kind,
  isSelected,
  onPress,
}: {
  readonly kind: FinancialAccountKind;
  readonly isSelected: boolean;
  readonly onPress: () => void;
}) {
  const { t } = useTranslation();
  const primary = useThemeColor("primary");
  const accentGreen = useThemeColor("accentGreen");

  return (
    <GlassPressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      radius={999}
      surfaceLayoutStyle={styles.kindChip}
    >
      <Text style={[styles.kindChipText, { color: isSelected ? accentGreen : primary }]}>
        {getKindEmoji(kind)} {t(`financialAccounts.kinds.${kind}`)}
      </Text>
    </GlassPressable>
  );
}
