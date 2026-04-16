import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScreenLayout } from "@/shared/components";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "@/shared/components/rn";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { cleanDigitInput } from "@/shared/lib";
import {
  ACCOUNT_SUBTYPE_OPTIONS,
  getAccountSubtypeLabelKey,
  hasValidCreditCardSchedule,
  isCreditCardSubtype,
  isLast4ValidOrEmpty,
} from "../lib/create-account";
import type { AccountSubtype } from "../schema";
import { useAccountsStore } from "../store";

const DEFAULT_SUBTYPE: AccountSubtype = "checking";

export function CreateAccountScreen() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const createAccount = useAccountsStore((s) => s.createAccount);

  const pageBg = useThemeColor("page");
  const cardBg = useThemeColor("card");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const tertiaryColor = useThemeColor("tertiary");
  const accentGreen = useThemeColor("accentGreen");
  const borderColor = useThemeColor("borderSubtle");

  const [subtype, setSubtype] = useState<AccountSubtype>(DEFAULT_SUBTYPE);
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [last4, setLast4] = useState("");
  const [balanceDigits, setBalanceDigits] = useState("");
  const [balanceDate, setBalanceDate] = useState(new Date());
  const [creditLimitDigits, setCreditLimitDigits] = useState("");
  const [closingDay, setClosingDay] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const { isBusy, run: guardedCreate } = useAsyncGuard();

  const isCreditCard = isCreditCardSubtype(subtype);
  const hasValidLast4 = isLast4ValidOrEmpty(last4);
  const hasValidCreditCardDays = hasValidCreditCardSchedule(subtype, closingDay, dueDay);
  const isFormValid =
    name.trim().length > 0 && institution.trim().length > 0 && hasValidLast4 && hasValidCreditCardDays;

  const handleSave = () => {
    void guardedCreate(async () => {
      const success = await createAccount({
        subtype,
        name,
        institution,
        last4,
        balanceDigits,
        balanceDate,
        creditLimitDigits,
        closingDay,
        dueDay,
      });

      if (success) router.back();
    });
  };

  return (
    <ScreenLayout title={t("accounts.createTitle")} variant="sub" onBack={() => router.back()}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={{ flex: 1, backgroundColor: cardBg }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.subtitle, { color: secondaryColor }]}>
            {t("accounts.createSubtitle")}
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: secondaryColor }]}>
              {t("accounts.subtypeLabel")}
            </Text>
            <View style={styles.chipRow}>
              {ACCOUNT_SUBTYPE_OPTIONS.map((option) => (
                <Pressable
                  key={option}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: subtype === option ? accentGreen : pageBg,
                      borderColor,
                    },
                  ]}
                  onPress={() => {
                    Keyboard.dismiss();
                    setSubtype(option);
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: subtype === option ? "#FFFFFF" : primaryColor },
                    ]}
                  >
                    {t(getAccountSubtypeLabelKey(option))}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: secondaryColor }]}>{t("common.name")}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: pageBg, color: primaryColor, borderColor }]}
              placeholder={t("accounts.namePlaceholder")}
              placeholderTextColor={tertiaryColor}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: secondaryColor }]}>
              {t("accounts.institutionLabel")}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: pageBg, color: primaryColor, borderColor }]}
              placeholder={t("accounts.institutionPlaceholder")}
              placeholderTextColor={tertiaryColor}
              value={institution}
              onChangeText={setInstitution}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: secondaryColor }]}>
              {t("accounts.last4Label")}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: pageBg, color: primaryColor, borderColor }]}
              placeholder={t("accounts.last4Placeholder")}
              placeholderTextColor={tertiaryColor}
              keyboardType="number-pad"
              value={last4}
              onChangeText={(value) => setLast4(cleanDigitInput(value).slice(0, 4))}
              maxLength={4}
            />
            {!hasValidLast4 ? (
              <Text style={[styles.helper, { color: tertiaryColor }]}>
                {t("accounts.last4Helper")}
              </Text>
            ) : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: secondaryColor }]}>
              {t("accounts.balanceLabel")}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: pageBg, color: primaryColor, borderColor }]}
              placeholder="0"
              placeholderTextColor={tertiaryColor}
              keyboardType="number-pad"
              value={balanceDigits}
              onChangeText={(value) => setBalanceDigits(cleanDigitInput(value))}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: secondaryColor }]}>
              {t("accounts.balanceDateLabel")}
            </Text>
            <Pressable
              style={[styles.input, styles.dateField, { backgroundColor: pageBg, borderColor }]}
              onPress={() => {
                Keyboard.dismiss();
                setShowDatePicker((current) => !current);
              }}
            >
              <Text style={[styles.dateText, { color: primaryColor }]}>
                {balanceDate.toLocaleDateString(locale, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </Text>
            </Pressable>
            {showDatePicker ? (
              <DateTimePicker
                value={balanceDate}
                mode="date"
                display={Platform.OS === "ios" ? "inline" : "default"}
                onChange={(_event, date) => {
                  if (Platform.OS === "android") setShowDatePicker(false);
                  if (date) setBalanceDate(date);
                }}
              />
            ) : null}
          </View>

          {isCreditCard ? (
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: secondaryColor }]}>
                {t("accounts.creditCardFields")}
              </Text>

              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: pageBg, color: primaryColor, borderColor },
                ]}
                placeholder={t("accounts.creditLimitLabel")}
                placeholderTextColor={tertiaryColor}
                keyboardType="number-pad"
                value={creditLimitDigits}
                onChangeText={(value) => setCreditLimitDigits(cleanDigitInput(value))}
              />

              <View style={styles.inlineFields}>
                <TextInput
                  style={[
                    styles.input,
                    styles.inlineInput,
                    { backgroundColor: pageBg, color: primaryColor, borderColor },
                  ]}
                  placeholder={t("accounts.closingDayLabel")}
                  placeholderTextColor={tertiaryColor}
                  keyboardType="number-pad"
                  value={closingDay}
                  onChangeText={(value) => setClosingDay(cleanDigitInput(value).slice(0, 2))}
                  maxLength={2}
                />
                <TextInput
                  style={[
                    styles.input,
                    styles.inlineInput,
                    { backgroundColor: pageBg, color: primaryColor, borderColor },
                  ]}
                  placeholder={t("accounts.dueDayLabel")}
                  placeholderTextColor={tertiaryColor}
                  keyboardType="number-pad"
                  value={dueDay}
                  onChangeText={(value) => setDueDay(cleanDigitInput(value).slice(0, 2))}
                  maxLength={2}
                />
              </View>

              {!hasValidCreditCardDays ? (
                <Text style={[styles.helper, { color: tertiaryColor }]}>
                  {t("accounts.dayHelper")}
                </Text>
              ) : null}
            </View>
          ) : null}

          <Pressable
            style={[
              styles.saveButton,
              {
                backgroundColor: accentGreen,
                opacity: isFormValid && !isBusy ? 1 : 0.5,
              },
            ]}
            onPress={handleSave}
            disabled={!isFormValid || isBusy}
          >
            <Text style={styles.saveButtonText}>{t("accounts.save")}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 24,
    gap: 16,
  },
  subtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    lineHeight: 20,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  helper: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    minHeight: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderCurve: "continuous",
    borderWidth: 1,
    paddingHorizontal: 16,
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
  dateField: {
    justifyContent: "center",
  },
  dateText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
  inlineFields: {
    flexDirection: "row",
    gap: 12,
  },
  inlineInput: {
    flex: 1,
  },
  saveButton: {
    minHeight: 48,
    borderRadius: 12,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  saveButtonText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
});
