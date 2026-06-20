import { FormSection } from "@/shared/components/FormSection";
import { FormTextField } from "@/shared/components/FormTextField";
import { Tag } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import { styles } from "./FinancialAccountForm.styles";
import { IdentifierChip } from "./IdentifierChip";
import { ManageIdentifiersButton } from "./ManageIdentifiersButton";
import type { FinancialAccountFormDetails } from "./useFinancialAccountForm";

export function FinancialAccountIdentifiersSection({
  existingDetails,
  isEdit,
  manualIdentifierValue,
  onManageIdentifiers,
  secondary,
  setManualIdentifierValue,
}: {
  readonly existingDetails: FinancialAccountFormDetails | null;
  readonly isEdit: boolean;
  readonly manualIdentifierValue: string;
  readonly onManageIdentifiers: (() => void) | null;
  readonly secondary: string;
  readonly setManualIdentifierValue: (value: string) => void;
}) {
  const { t } = useTranslation();

  if (isEdit) {
    return (
      <FormSection title={t("financialAccounts.detail.identifiersTitle")}>
        {existingDetails?.identifiers.length ? (
          <View style={styles.identifierWrap}>
            {existingDetails.identifiers.map((identifier) => (
              <IdentifierChip key={identifier.id} value={identifier.value} />
            ))}
          </View>
        ) : (
          <Text style={[styles.helperText, styles.identifierEmpty, { color: secondary }]}>
            {t("financialAccounts.detail.identifiersEmpty")}
          </Text>
        )}

        {onManageIdentifiers ? (
          <ManageIdentifiersButton
            label={t("financialAccounts.detail.manageIdentifiers")}
            onPress={onManageIdentifiers}
          />
        ) : null}
      </FormSection>
    );
  }

  return (
    <FormSection title={t("financialAccounts.detail.identifiersTitle")}>
      <FormTextField
        icon={Tag}
        label={t("financialAccounts.identifierScreen.label")}
        value={manualIdentifierValue}
        onChangeText={setManualIdentifierValue}
        placeholder={t("financialAccounts.identifierScreen.placeholder")}
        helperText={t("financialAccounts.identifierScreen.note")}
      />
    </FormSection>
  );
}
