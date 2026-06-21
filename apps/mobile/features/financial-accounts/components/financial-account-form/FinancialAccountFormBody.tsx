import { format } from "date-fns";
import { useState } from "react";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { DatePickerControl } from "@/shared/components/DatePickerControl";
import { FieldButton } from "@/shared/components/FieldButton";
import { FormScreen } from "@/shared/components/FormScreen";
import { FormSection } from "@/shared/components/FormSection";
import { FormTextField } from "@/shared/components/FormTextField";
import { Calendar, CreditCard, Tag, Wallet } from "@/shared/components/icons";
import { Keyboard, Platform, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import { canFinancialAccountHaveIdentifiers } from "../../lib/kind";
import { styles } from "./FinancialAccountForm.styles";
import { FinancialAccountKindPicker } from "./FinancialAccountFormFields";
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
  const currentDatePlaceholder = format(datePickerFallback, "PPP", {
    locale: getDateFnsLocale(locale),
  });
  const currentDayPlaceholder = format(datePickerFallback, "d", {
    locale: getDateFnsLocale(locale),
  });
  const secondary = useThemeColor("secondary");
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
        <FinancialAccountKindPicker
          value={kind}
          onChange={setKind}
          style={[styles.kindWrap, styles.typeFirstSection]}
          chipStyle={styles.kindChip}
        />
      </FormSection>

      <FormSection title={t("financialAccounts.form.basicInfoSection")}>
        <FormTextField
          icon={Wallet}
          label={t("financialAccounts.form.nameLabel")}
          value={name}
          onChangeText={setName}
          placeholder={t("financialAccounts.form.namePlaceholder")}
        />

        {canFinancialAccountHaveIdentifiers(kind) && !isEdit ? (
          <FormTextField
            icon={Tag}
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
          icon={Wallet}
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
            icon={Calendar}
            label={t("financialAccounts.form.dateLabel")}
            value={
              effectiveDate
                ? format(effectiveDate, "PPP", { locale: getDateFnsLocale(locale) })
                : ""
            }
            placeholder={currentDatePlaceholder}
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
            <DatePickerControl
              value={effectiveDate ?? datePickerFallback}
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onSelect={setEffectiveDate}
              onClose={() => setShowDatePicker(false)}
            />
          ) : null}
        </View>
      </FormSection>

      {kind === "credit_card" ? (
        <FormSection title={t("financialAccounts.detail.billingProfileTitle")}>
          <FormTextField
            icon={CreditCard}
            label={t("financialAccounts.form.statementClosingDay")}
            value={statementClosingDayText}
            onChangeText={setStatementClosingDayText}
            keyboardType="number-pad"
            placeholder={currentDayPlaceholder}
            maxLength={2}
          />

          <FormTextField
            icon={CreditCard}
            label={t("financialAccounts.form.paymentDueDay")}
            value={paymentDueDayText}
            onChangeText={setPaymentDueDayText}
            keyboardType="number-pad"
            placeholder={currentDayPlaceholder}
            maxLength={2}
          />

          <Card padded={false} radius={8} contentStyle={styles.noteBanner}>
            <Text style={[styles.noteText, { color: secondary }]}>
              {t("financialAccounts.form.billingHint")}
            </Text>
          </Card>
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
