import {
  type FinancialAccountKind,
  financialAccountKindSchema,
} from "@/features/financial-accounts/schema";
import { getKindEmoji } from "@/features/financial-accounts/lib/kind-display";
import { GlassSurface } from "@/shared/components/GlassSurface";
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
  const accentGreen = useThemeColor("accentGreen");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
    >
      <GlassSurface
        nativeGlass={false}
        padded={false}
        radius={999}
        style={[
          styles.kindChip,
          { backgroundColor: "transparent" },
          isSelected ? { backgroundColor: accentGreen } : null,
        ]}
      >
        <Text style={[styles.kindChipText, { color: isSelected ? onAccent : primary }]}>
          {getKindEmoji(kind)} {t(`financialAccounts.kinds.${kind}`)}
        </Text>
      </GlassSurface>
    </Pressable>
  );
}
