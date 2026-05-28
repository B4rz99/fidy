import type { ReactNode } from "react";
import {
  type FinancialAccountKind,
  financialAccountKindSchema,
} from "@/features/financial-accounts/public";
import { getKindEmoji } from "@/features/financial-accounts/lib/kind-display";
import { ChevronRight } from "@/shared/components/icons";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { styles } from "./FinancialAccountForm.styles";

export const ACCOUNT_KIND_OPTIONS = financialAccountKindSchema.options;

export function FormSection({
  optionalLabel,
  title,
  children,
}: {
  readonly optionalLabel?: string;
  readonly title: string;
  readonly children: ReactNode;
}) {
  const secondary = useThemeColor("secondary");
  const card = useThemeColor("card");
  const borderSubtle = useThemeColor("borderSubtle");

  return (
    <View style={[styles.formSection, { backgroundColor: card, borderColor: borderSubtle }]}>
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, { color: secondary }]}>{title}</Text>
        {optionalLabel ? (
          <Text style={[styles.sectionOptionalLabel, { color: secondary }]}>{optionalLabel}</Text>
        ) : null}
      </View>
      {children}
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
