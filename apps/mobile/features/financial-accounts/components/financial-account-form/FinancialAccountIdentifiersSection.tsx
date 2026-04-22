import { Text, TextInput, View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import { styles } from "./FinancialAccountForm.styles";
import {
  FieldLabel,
  FormSection,
  IdentifierChip,
  ManageIdentifiersButton,
} from "./FinancialAccountFormFields";
import type { FinancialAccountFormDetails } from "./useFinancialAccountForm";

export function FinancialAccountIdentifiersSection({
  borderSubtle,
  card,
  existingDetails,
  isEdit,
  manualIdentifierValue,
  onManageIdentifiers,
  primary,
  secondary,
  setManualIdentifierValue,
  tertiary,
}: {
  readonly borderSubtle: string;
  readonly card: string;
  readonly existingDetails: FinancialAccountFormDetails | null;
  readonly isEdit: boolean;
  readonly manualIdentifierValue: string;
  readonly onManageIdentifiers: (() => void) | null;
  readonly primary: string;
  readonly secondary: string;
  readonly setManualIdentifierValue: (value: string) => void;
  readonly tertiary: string;
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
      <View style={styles.fieldBlock}>
        <FieldLabel>{t("financialAccounts.identifierSheet.label")}</FieldLabel>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: card,
              borderColor: borderSubtle,
              color: primary,
            },
          ]}
          value={manualIdentifierValue}
          onChangeText={setManualIdentifierValue}
          placeholder={t("financialAccounts.identifierSheet.placeholder")}
          placeholderTextColor={tertiary}
        />
        <Text style={[styles.helperText, { color: secondary }]}>
          {t("financialAccounts.identifierSheet.note")}
        </Text>
      </View>
    </FormSection>
  );
}
