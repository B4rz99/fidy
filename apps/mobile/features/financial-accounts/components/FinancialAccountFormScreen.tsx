import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { format } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import { type ReactNode, useCallback, useState } from "react";
import { useOptionalUserId } from "@/features/auth";
import {
  type FinancialAccountKind,
  financialAccountKindSchema,
} from "@/features/financial-accounts";
import {
  getFinancialAccountFormScreenState,
  hasInvalidBillingDayInput,
  type FinancialAccountFormLookupStatus,
} from "@/features/financial-accounts/lib/form-screen";
import { readFinancialAccountKind } from "@/features/financial-accounts/lib/kind";
import { createFinancialAccountManagementService } from "@/features/financial-accounts/lib/management-service";
import { parseFinancialAccountRouteParam } from "@/features/financial-accounts/lib/route-params";
import { ScreenLayout } from "@/shared/components";
import { ChevronRight, X } from "@/shared/components/icons";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import {
  cleanDigitInput,
  formatMoney,
  parseDigitsToAmount,
  parseOptionalIsoDate,
  showErrorToast,
  toIsoDate,
} from "@/shared/lib";

const managementService = createFinancialAccountManagementService();
const ACCOUNT_KIND_OPTIONS = financialAccountKindSchema.options;

type AccountDetails = NonNullable<ReturnType<typeof managementService.getAccountDetails>>;

function FormSection({
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

function FieldLabel({ children }: { readonly children: string }) {
  const secondary = useThemeColor("secondary");
  return <Text style={[styles.fieldLabel, { color: secondary }]}>{children}</Text>;
}

function KindChip({
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

function IdentifierChip({ value }: { readonly value: string }) {
  const primary = useThemeColor("primary");
  const peachLight = useThemeColor("peachLight");

  return (
    <View style={[styles.identifierChip, { backgroundColor: peachLight }]}>
      <Text style={[styles.identifierChipText, { color: primary }]}>{value}</Text>
    </View>
  );
}

function parseOptionalDay(value: string): number | null {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  return /^\d+$/.test(trimmedValue) ? Number.parseInt(trimmedValue, 10) : Number.NaN;
}

function FinancialAccountFormBody({
  existingDetails,
  onManageIdentifiers,
}: {
  readonly existingDetails: AccountDetails | null;
  readonly onManageIdentifiers: (() => void) | null;
}) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const borderSubtle = useThemeColor("borderSubtle");
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");
  const accentRed = useThemeColor("accentRed");
  const card = useThemeColor("card");
  const existingOpeningBalance = existingDetails?.openingBalance ?? null;
  const [name, setName] = useState(existingDetails?.account.name ?? "");
  const [kind, setKind] = useState<FinancialAccountKind>(
    existingDetails ? readFinancialAccountKind(existingDetails.account.kind) : "checking"
  );
  const [amountDigits, setAmountDigits] = useState(
    existingOpeningBalance ? String(existingOpeningBalance.amount) : ""
  );
  const [effectiveDate, setEffectiveDate] = useState<Date | null>(
    parseOptionalIsoDate(existingOpeningBalance?.effectiveDate)
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [manualIdentifierValue, setManualIdentifierValue] = useState("");
  const [statementClosingDayText, setStatementClosingDayText] = useState(
    existingDetails?.account.statementClosingDay?.toString() ?? ""
  );
  const [paymentDueDayText, setPaymentDueDayText] = useState(
    existingDetails?.account.paymentDueDay?.toString() ?? ""
  );
  const { isBusy, run: guardedSave } = useAsyncGuard();
  const isEdit = existingDetails != null;
  const amountPreview =
    amountDigits.length > 0 ? formatMoney(parseDigitsToAmount(amountDigits)) : null;

  const handleSave = () => {
    const parsedOpeningBalanceAmount =
      amountDigits.length > 0 ? parseDigitsToAmount(amountDigits) : null;
    const parsedEffectiveDate = effectiveDate ? toIsoDate(effectiveDate) : null;
    const parsedStatementClosingDay = parseOptionalDay(statementClosingDayText);
    const parsedPaymentDueDay = parseOptionalDay(paymentDueDayText);
    const hasPartialOpeningBalance =
      (parsedOpeningBalanceAmount != null && parsedEffectiveDate == null) ||
      (parsedOpeningBalanceAmount == null && parsedEffectiveDate != null);
    const hasInvalidBillingDay = hasInvalidBillingDayInput({
      kind,
      statementClosingDay: parsedStatementClosingDay,
      paymentDueDay: parsedPaymentDueDay,
    });

    if (hasPartialOpeningBalance) {
      showErrorToast(t("financialAccounts.form.invalidOpeningBalance"));
      return;
    }

    if (hasInvalidBillingDay) {
      showErrorToast(t("financialAccounts.form.invalidBillingDay"));
      return;
    }

    void guardedSave(async () => {
      try {
        if (!db || !userId) {
          return;
        }

        if (isEdit && existingDetails) {
          managementService.updateAccount({
            db,
            userId,
            accountId: existingDetails.account.id,
            name,
            kind,
            openingBalanceAmount: parsedOpeningBalanceAmount,
            openingBalanceEffectiveDate: parsedEffectiveDate,
            statementClosingDay: parsedStatementClosingDay,
            paymentDueDay: parsedPaymentDueDay,
          });
        } else {
          managementService.createAccount({
            db,
            userId,
            name,
            kind,
            openingBalanceAmount: parsedOpeningBalanceAmount,
            openingBalanceEffectiveDate: parsedEffectiveDate,
            manualIdentifierValue,
            statementClosingDay: parsedStatementClosingDay,
            paymentDueDay: parsedPaymentDueDay,
          });
        }

        router.back();
      } catch {
        showErrorToast(t("financialAccounts.form.saveFailed"));
      }
    });
  };

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
            onChangeText={(value) => setAmountDigits(cleanDigitInput(value))}
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
              value={effectiveDate ?? new Date()}
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

      {isEdit ? (
        <FormSection title={t("financialAccounts.detail.identifiersTitle")}>
          {existingDetails.identifiers.length > 0 ? (
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
            <Pressable style={styles.manageButton} onPress={onManageIdentifiers}>
              <Text style={[styles.manageButtonText, { color: primary }]}>
                {t("financialAccounts.detail.manageIdentifiers")}
              </Text>
              <ChevronRight size={16} color={secondary} />
            </Pressable>
          ) : null}
        </FormSection>
      ) : (
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
      )}

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

export function FinancialAccountFormScreen() {
  const router = useRouter();
  const { accountId: rawAccountId } = useLocalSearchParams<{ accountId?: string }>();
  const accountId = parseFinancialAccountRouteParam(rawAccountId);
  const { t } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const [existingDetails, setExistingDetails] = useState<AccountDetails | null>(null);
  const [lookupStatus, setLookupStatus] = useState<FinancialAccountFormLookupStatus>(
    accountId ? "loading" : "idle"
  );
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");

  const reloadAccount = useCallback(() => {
    if (!accountId) {
      setExistingDetails(null);
      setLookupStatus("idle");
      return;
    }

    if (!db) {
      setExistingDetails(null);
      setLookupStatus("loading");
      return;
    }

    const nextDetails = managementService.getAccountDetails({ db, accountId });

    setExistingDetails(nextDetails);
    setLookupStatus(nextDetails ? "ready" : "missing");
  }, [db, accountId]);

  useFocusEffect(reloadAccount);
  const screenState = getFinancialAccountFormScreenState({ accountId, lookupStatus });

  if (screenState === "loading") {
    return (
      <ScreenLayout
        title={t("financialAccounts.form.editTitle")}
        variant="sub"
        onBack={() => router.back()}
      >
        <View style={styles.stateContainer}>
          <ActivityIndicator size="small" color={accentGreen} />
          <Text style={[styles.stateTitle, { color: primary }]}>
            {t("financialAccounts.form.loading")}
          </Text>
        </View>
      </ScreenLayout>
    );
  }

  if (screenState === "missing") {
    return (
      <ScreenLayout
        title={t("financialAccounts.form.editTitle")}
        variant="sub"
        onBack={() => router.replace("/financial-accounts")}
      >
        <View style={styles.stateContainer}>
          <Text style={[styles.stateTitle, { color: primary }]}>
            {t("financialAccounts.form.missingTitle")}
          </Text>
          <Text style={[styles.stateBody, { color: secondary }]}>
            {t("financialAccounts.form.missingBody")}
          </Text>
          <Pressable
            style={[styles.primaryButton, styles.stateButton, { backgroundColor: accentGreen }]}
            onPress={() => router.replace("/financial-accounts")}
          >
            <Text style={styles.primaryButtonText}>
              {t("financialAccounts.form.missingCta")}
            </Text>
          </Pressable>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      title={
        accountId ? t("financialAccounts.form.editTitle") : t("financialAccounts.form.createTitle")
      }
      variant="sub"
      onBack={() => router.back()}
    >
      <FinancialAccountFormBody
        key={accountId ?? "create"}
        existingDetails={existingDetails}
        onManageIdentifiers={
          accountId
            ? () =>
                router.push({
                  pathname: "/financial-account-identifier",
                  params: { accountId },
                })
            : null
        }
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 18,
  },
  stateContainer: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  stateTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center",
  },
  stateBody: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  stateButton: {
    minWidth: 180,
  },
  subtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
  },
  card: {
    borderRadius: 18,
    padding: 16,
    gap: 16,
  },
  fieldBlock: {
    gap: 8,
  },
  fieldLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
  helperText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    lineHeight: 18,
  },
  kindWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  kindChip: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    justifyContent: "center",
  },
  kindChipText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
  noteBanner: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noteText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    lineHeight: 18,
  },
  identifierWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  identifierChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  identifierChipText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  identifierEmpty: {
    paddingTop: 4,
  },
  manageButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  manageButtonText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
  },
});
