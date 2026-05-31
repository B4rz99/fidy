import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { useState } from "react";
import { Button } from "@/shared/components/Button";
import { FieldButton } from "@/shared/components/FieldButton";
import { FormScreen } from "@/shared/components/FormScreen";
import { FormSection } from "@/shared/components/FormSection";
import { FormTextField } from "@/shared/components/FormTextField";
import { Keyboard, Platform, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import { canFinancialAccountHaveIdentifiers } from "../../lib/kind";
import { styles } from "./FinancialAccountForm.styles";
import { ACCOUNT_KIND_OPTIONS, KindChip } from "./FinancialAccountFormFields";
import { FinancialAccountIdentifiersSection } from "./FinancialAccountIdentifiersSection";
import {
  type FinancialAccountFormDetails,
  useFinancialAccountForm,
} from "./useFinancialAccountForm";

export function FinancialAccountFormBody({
  existingDetails,
  onManageIdentifiers,
}: {
  readonly existingDetails: FinancialAccountFormDetails | null;
  readonly onManageIdentifiers: (() => void) | null;
}) {
  const { t, locale } = useTranslation();
  const [datePickerFallback] = useState(() => new Date());
  const secondary = useThemeColor("secondary");
  const accentGreenLight = useThemeColor("accentGreenLight");
  const {
    amountDigits,
    amountPreview,
    effectiveDate,
    handleSave,
    isBusy,
    isEdit,
    kind,
    manualIdentifierValue,
    name,
    paymentDueDayText,
    setAmountDigits,
    setEffectiveDate,
    setKind,
    setManualIdentifierValue,
    setName,
    setPaymentDueDayText,
    setShowDatePicker,
    setStatementClosingDayText,
    showDatePicker,
    statementClosingDayText,
  } = useFinancialAccountForm({ existingDetails });

  return (
    <FormScreen contentContainerStyle={styles.content}>
      <FormSection title={t("financialAccounts.form.kindLabel")}>
        <View style={[styles.kindWrap, styles.typeFirstSection]}>
          {ACCOUNT_KIND_OPTIONS.map((option) => (
            <KindChip
              key={option}
              kind={option}
              isSelected={option === kind}
              onPress={() => setKind(option)}
            />
          ))}
        </View>
      </FormSection>

      <FormSection title={t("financialAccounts.form.basicInfoSection")}>
        <FormTextField
          label={t("financialAccounts.form.nameLabel")}
          value={name}
          onChangeText={setName}
          placeholder={t("financialAccounts.form.namePlaceholder")}
        />

        {canFinancialAccountHaveIdentifiers(kind) && !isEdit ? (
          <FormTextField
            label={t("financialAccounts.identifierScreen.label")}
            value={manualIdentifierValue}
            onChangeText={setManualIdentifierValue}
            placeholder={t("financialAccounts.identifierScreen.placeholder")}
          />
        ) : null}
      </FormSection>

      <FormSection
        title={t("financialAccounts.detail.openingBalanceSection")}
        optionalLabel={t("financialAccounts.form.optionalLabel")}
      >
        <FormTextField
          label={
            kind === "credit_card"
              ? t("financialAccounts.form.debtLabel")
              : t("financialAccounts.form.balanceLabel")
          }
          value={amountDigits}
          onChangeText={setAmountDigits}
          keyboardType="number-pad"
          placeholder="0"
          helperText={amountPreview}
        />

        <View style={styles.fieldBlock}>
          <FieldButton
            label={t("financialAccounts.form.dateLabel")}
            value={
              effectiveDate
                ? format(effectiveDate, "PPP", { locale: getDateFnsLocale(locale) })
                : ""
            }
            placeholder={t("financialAccounts.form.datePlaceholder")}
            onPress={() => {
              Keyboard.dismiss();
              setShowDatePicker(true);
            }}
            onClear={
              effectiveDate
                ? () => {
                    setEffectiveDate(null);
                    setShowDatePicker(false);
                  }
                : undefined
            }
            clearAccessibilityLabel={t("common.clear")}
          />

          {showDatePicker ? (
            <DateTimePicker
              value={effectiveDate ?? datePickerFallback}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_event, date) => {
                if (Platform.OS === "android") {
                  setShowDatePicker(false);
                }
                if (date) {
                  setEffectiveDate(date);
                }
              }}
            />
          ) : null}
        </View>
      </FormSection>

      {kind === "credit_card" ? (
        <FormSection title={t("financialAccounts.detail.billingProfileTitle")}>
          <FormTextField
            label={t("financialAccounts.form.statementClosingDay")}
            value={statementClosingDayText}
            onChangeText={setStatementClosingDayText}
            keyboardType="number-pad"
            placeholder={t("financialAccounts.form.dayPlaceholder")}
            maxLength={2}
          />

          <FormTextField
            label={t("financialAccounts.form.paymentDueDay")}
            value={paymentDueDayText}
            onChangeText={setPaymentDueDayText}
            keyboardType="number-pad"
            placeholder={t("financialAccounts.form.dayPlaceholder")}
            maxLength={2}
          />

          <View style={[styles.noteBanner, { backgroundColor: accentGreenLight }]}>
            <Text style={[styles.noteText, { color: secondary }]}>
              {t("financialAccounts.form.billingHint")}
            </Text>
          </View>
        </FormSection>
      ) : null}

      {isEdit && canFinancialAccountHaveIdentifiers(kind) ? (
        <FinancialAccountIdentifiersSection
          existingDetails={existingDetails}
          isEdit={isEdit}
          manualIdentifierValue={manualIdentifierValue}
          onManageIdentifiers={onManageIdentifiers}
          secondary={secondary}
          setManualIdentifierValue={setManualIdentifierValue}
        />
      ) : null}

      <Button
        label={
          isEdit ? t("financialAccounts.form.saveEdit") : t("financialAccounts.form.saveCreate")
        }
        disabled={isBusy || name.trim().length === 0}
        onPress={handleSave}
        loading={isBusy}
      />
    </FormScreen>
  );
}
