import {
  type FinancialAccountKind,
  financialAccountKindSchema,
} from "@/features/financial-accounts/schema";
import { getKindEmoji } from "@/features/financial-accounts/lib/kind-display";
import { GlassPressable } from "@/shared/components/GlassPressable";
import { Text } from "@/shared/components/rn";
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
  const accentGreen = useThemeColor("accentGreen");

  return (
    <GlassPressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      backgroundColor={isSelected ? accentGreen : undefined}
      nativeGlass={false}
      radius={999}
      surfaceLayoutStyle={styles.kindChip}
    >
      <Text style={[styles.kindChipText, { color: isSelected ? onAccent : primary }]}>
        {getKindEmoji(kind)} {t(`financialAccounts.kinds.${kind}`)}
      </Text>
    </GlassPressable>
  );
}
