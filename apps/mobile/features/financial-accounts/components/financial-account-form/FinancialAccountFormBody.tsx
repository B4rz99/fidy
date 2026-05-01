import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { X } from "@/shared/components/icons";
import { useState } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "@/shared/components/rn";
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
  const [datePickerFallback] = useState(() => new Date());
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const borderSubtle = useThemeColor("borderSubtle");
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");
  const accentRed = useThemeColor("accentRed");
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
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.subtitle, { color: secondary }]}>
        {isEdit
          ? t("financialAccounts.form.editSubtitle")
          : t("financialAccounts.form.createSubtitle")}
      </Text>

      <FormSection title={t("financialAccounts.detail.accountSection")}>
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

        <View style={styles.fieldBlock}>
          <FieldLabel>{t("financialAccounts.form.kindLabel")}</FieldLabel>
          <View style={styles.kindWrap}>
            {ACCOUNT_KIND_OPTIONS.map((option) => (
              <KindChip
                key={option}
                kind={option}
                isSelected={option === kind}
                onPress={() => setKind(option)}
              />
            ))}
          </View>
        </View>
      </FormSection>

      <FormSection title={t("financialAccounts.detail.openingBalanceSection")}>
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
          <FieldLabel>{t("financialAccounts.form.dateLabel")}</FieldLabel>
          <Pressable
            style={[
              styles.input,
              styles.dateButton,
              { backgroundColor: card, borderColor: borderSubtle },
            ]}
            onPress={() => {
              Keyboard.dismiss();
              setShowDatePicker(true);
            }}
          >
            <Text style={[styles.dateText, { color: effectiveDate ? primary : tertiary }]}>
              {effectiveDate
                ? format(effectiveDate, "PPP", { locale: getDateFnsLocale(locale) })
                : t("financialAccounts.form.datePlaceholder")}
            </Text>

            {effectiveDate ? (
              <Pressable
                onPress={() => {
                  setEffectiveDate(null);
                  setShowDatePicker(false);
                }}
                hitSlop={8}
              >
                <X size={16} color={accentRed} />
              </Pressable>
            ) : null}
          </Pressable>

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

      {canFinancialAccountHaveIdentifiers(kind) ? (
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

      <Pressable
        style={[
          styles.primaryButton,
          {
            backgroundColor: accentGreen,
            opacity: isBusy || name.trim().length === 0 ? 0.5 : 1,
          },
        ]}
        disabled={isBusy || name.trim().length === 0}
        onPress={handleSave}
      >
        <Text style={styles.primaryButtonText}>
          {isEdit ? t("financialAccounts.form.saveEdit") : t("financialAccounts.form.saveCreate")}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
