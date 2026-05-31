import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/shared/components/Button";
import { FieldButton } from "@/shared/components/FieldButton";
import { Keyboard, Platform, ScrollView, Text, TextInput, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import { canFinancialAccountHaveIdentifiers } from "../../lib/kind";
import { styles } from "./FinancialAccountForm.styles";
import {
  ACCOUNT_KIND_OPTIONS,
  FieldLabel,
  FormSection,
  KindChip,
} from "./FinancialAccountFormFields";
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
  const { bottom } = useSafeAreaInsets();
  const [datePickerFallback] = useState(() => new Date());
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const borderSubtle = useThemeColor("borderSubtle");
  const accentGreenLight = useThemeColor("accentGreenLight");
  const card = useThemeColor("card");
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
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, { paddingBottom: bottom + 32 }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
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
        <View style={styles.fieldBlock}>
          <FieldLabel>{t("financialAccounts.form.nameLabel")}</FieldLabel>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: card,
                borderColor: borderSubtle,
                color: primary,
              },
            ]}
            value={name}
            onChangeText={setName}
            placeholder={t("financialAccounts.form.namePlaceholder")}
            placeholderTextColor={tertiary}
          />
        </View>

        {canFinancialAccountHaveIdentifiers(kind) && !isEdit ? (
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
          </View>
        ) : null}
      </FormSection>

      <FormSection
        title={t("financialAccounts.detail.openingBalanceSection")}
        optionalLabel={t("financialAccounts.form.optionalLabel")}
      >
        <View style={styles.fieldBlock}>
          <FieldLabel>
            {kind === "credit_card"
              ? t("financialAccounts.form.debtLabel")
              : t("financialAccounts.form.balanceLabel")}
          </FieldLabel>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: card,
                borderColor: borderSubtle,
                color: primary,
              },
            ]}
            value={amountDigits}
            onChangeText={setAmountDigits}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={tertiary}
          />
          {amountPreview ? (
            <Text style={[styles.helperText, { color: secondary }]}>{amountPreview}</Text>
          ) : null}
        </View>

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
          <View style={styles.fieldBlock}>
            <FieldLabel>{t("financialAccounts.form.statementClosingDay")}</FieldLabel>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: card,
                  borderColor: borderSubtle,
                  color: primary,
                },
              ]}
              value={statementClosingDayText}
              onChangeText={setStatementClosingDayText}
              keyboardType="number-pad"
              placeholder={t("financialAccounts.form.dayPlaceholder")}
              placeholderTextColor={tertiary}
              maxLength={2}
            />
          </View>

          <View style={styles.fieldBlock}>
            <FieldLabel>{t("financialAccounts.form.paymentDueDay")}</FieldLabel>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: card,
                  borderColor: borderSubtle,
                  color: primary,
                },
              ]}
              value={paymentDueDayText}
              onChangeText={setPaymentDueDayText}
              keyboardType="number-pad"
              placeholder={t("financialAccounts.form.dayPlaceholder")}
              placeholderTextColor={tertiary}
              maxLength={2}
            />
          </View>

          <View style={[styles.noteBanner, { backgroundColor: accentGreenLight }]}>
            <Text style={[styles.noteText, { color: secondary }]}>
              {t("financialAccounts.form.billingHint")}
            </Text>
          </View>
        </FormSection>
      ) : null}

      {isEdit && canFinancialAccountHaveIdentifiers(kind) ? (
        <FinancialAccountIdentifiersSection
          borderSubtle={borderSubtle}
          card={card}
          existingDetails={existingDetails}
          isEdit={isEdit}
          manualIdentifierValue={manualIdentifierValue}
          onManageIdentifiers={onManageIdentifiers}
          primary={primary}
          secondary={secondary}
          setManualIdentifierValue={setManualIdentifierValue}
          tertiary={tertiary}
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
    </ScrollView>
  );
}
