import type { ReactNode } from "react";
import {
  type FinancialAccountKind,
  financialAccountKindSchema,
} from "@/features/financial-accounts/public";
import { ChevronRight } from "@/shared/components/icons";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { styles } from "./FinancialAccountForm.styles";

export const ACCOUNT_KIND_OPTIONS = financialAccountKindSchema.options;

export function FormSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  const primary = useThemeColor("primary");
  const card = useThemeColor("card");

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: primary }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: card }]}>{children}</View>
    </View>
  );
}

export function FieldLabel({ children }: { readonly children: string }) {
  const secondary = useThemeColor("secondary");
  return <Text style={[styles.fieldLabel, { color: secondary }]}>{children}</Text>;
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
  const card = useThemeColor("card");
  const borderSubtle = useThemeColor("borderSubtle");
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");

  return (
    <Pressable
      style={[
        styles.kindChip,
        {
          backgroundColor: isSelected ? accentGreenLight : card,
          borderColor: isSelected ? accentGreen : borderSubtle,
        },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.kindChipText, { color: primary }]}>
        {t(`financialAccounts.kinds.${kind}`)}
      </Text>
    </Pressable>
  );
}

export function IdentifierChip({ value }: { readonly value: string }) {
  const primary = useThemeColor("primary");
  const peachLight = useThemeColor("peachLight");

  return (
    <View style={[styles.identifierChip, { backgroundColor: peachLight }]}>
      <Text style={[styles.identifierChipText, { color: primary }]}>{value}</Text>
    </View>
  );
}

export function ManageIdentifiersButton({
  label,
  onPress,
}: {
  readonly label: string;
  readonly onPress: () => void;
}) {
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");

  return (
    <Pressable style={styles.manageButton} onPress={onPress}>
      <Text style={[styles.manageButtonText, { color: primary }]}>{label}</Text>
      <ChevronRight size={16} color={secondary} />
    </Pressable>
  );
}
