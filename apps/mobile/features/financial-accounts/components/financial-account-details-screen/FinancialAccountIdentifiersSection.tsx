import { ChevronRight } from "@/shared/components/icons";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { FinancialAccountDetailSection } from "./FinancialAccountDetailSection";
import { styles } from "./FinancialAccountDetailsScreen.styles";

function IdentifierChip({ value }: { readonly value: string }) {
  const primary = useThemeColor("primary");
  const peachLight = useThemeColor("peachLight");

  return (
    <View style={[styles.identifierChip, { backgroundColor: peachLight }]}>
      <Text style={[styles.identifierChipText, { color: primary }]}>{value}</Text>
    </View>
  );
}

export function FinancialAccountIdentifiersSection({
  identifiers,
  onManageIdentifiers,
}: {
  readonly identifiers: readonly { readonly id: string; readonly value: string }[];
  readonly onManageIdentifiers: () => void;
}) {
  const { t } = useTranslation();
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");

  return (
    <FinancialAccountDetailSection title={t("financialAccounts.detail.identifiersTitle")}>
      {identifiers.length > 0 ? (
        <View style={styles.identifierWrap}>
          {identifiers.map((identifier) => (
            <IdentifierChip key={identifier.id} value={identifier.value} />
          ))}
        </View>
      ) : (
        <Text style={[styles.emptyIdentifiers, { color: secondary }]}>
          {t("financialAccounts.detail.identifiersEmpty")}
        </Text>
      )}

      <Pressable style={styles.manageButton} onPress={onManageIdentifiers}>
        <Text style={[styles.manageButtonText, { color: primary }]}>
          {t("financialAccounts.detail.manageIdentifiers")}
        </Text>
        <ChevronRight size={16} color={secondary} />
      </Pressable>
    </FinancialAccountDetailSection>
  );
}
