import {
  type FinancialAccountKind,
  financialAccountKindSchema,
} from "@/features/financial-accounts/schema";
import { getKindEmoji } from "@/features/financial-accounts/lib/kind-display";
import { Pressable, Text } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { styles } from "./FinancialAccountForm.styles";

export const ACCOUNT_KIND_OPTIONS = financialAccountKindSchema.options;

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
  const onAccent = useThemeColor("onAccent");
  const peachLight = useThemeColor("peachLight");
  const borderSubtle = useThemeColor("borderSubtle");
  const accentGreen = useThemeColor("accentGreen");

  return (
    <Pressable
      style={[
        styles.kindChip,
        isSelected ? styles.kindChipSelected : null,
        {
          backgroundColor: isSelected ? accentGreen : peachLight,
          borderColor: isSelected ? accentGreen : borderSubtle,
        },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.kindChipText, { color: isSelected ? onAccent : primary }]}>
        {getKindEmoji(kind)} {t(`financialAccounts.kinds.${kind}`)}
      </Text>
    </Pressable>
  );
}
