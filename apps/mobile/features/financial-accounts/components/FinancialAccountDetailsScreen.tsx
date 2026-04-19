import { useFocusEffect } from "@react-navigation/native";
import { format } from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import { type ReactNode, useCallback, useState } from "react";
import { useOptionalUserId } from "@/features/auth";
import { readFinancialAccountKind } from "@/features/financial-accounts/lib/kind";
import { createFinancialAccountManagementService } from "@/features/financial-accounts/lib/management-service";
import { parseFinancialAccountRouteParam } from "@/features/financial-accounts/lib/route-params";
import { ScreenLayout } from "@/shared/components";
import { ChevronRight, TriangleAlert } from "@/shared/components/icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import { formatMoney, parseOptionalIsoDate } from "@/shared/lib";

const managementService = createFinancialAccountManagementService();

function DetailSection({
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

function FieldRow({ label, value }: { readonly label: string; readonly value: string }) {
  const secondary = useThemeColor("secondary");
  const primary = useThemeColor("primary");
  const borderSubtle = useThemeColor("borderSubtle");

  return (
    <View style={[styles.fieldRow, { borderBottomColor: borderSubtle }]}>
      <Text style={[styles.fieldLabel, { color: secondary }]}>{label}</Text>
      <Text style={[styles.fieldValue, { color: primary }]}>{value}</Text>
    </View>
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

export function FinancialAccountDetailsScreen() {
  const router = useRouter();
  const { accountId: rawAccountId } = useLocalSearchParams<{ accountId?: string }>();
  const accountId = parseFinancialAccountRouteParam(rawAccountId);
  const { t, locale } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const accentRed = useThemeColor("accentRed");
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");
  const [details, setDetails] = useState<ReturnType<
    typeof managementService.getAccountDetails
  > | null>(null);

  const reloadDetails = useCallback(() => {
    if (!db || !accountId) {
      setDetails(null);
      return;
    }

    setDetails(managementService.getAccountDetails({ db, accountId }));
  }, [db, accountId]);

  useFocusEffect(reloadDetails);

  if (!accountId) {
    return null;
  }

  if (details == null) {
    return (
      <ScreenLayout
        title={t("financialAccounts.detail.title")}
        variant="sub"
        onBack={() => router.back()}
      >
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: primary }]}>
            {t("financialAccounts.list.emptyTitle")}
          </Text>
        </View>
      </ScreenLayout>
    );
  }

  const kind = readFinancialAccountKind(details.account.kind);
  const isCreditCard = kind === "credit_card";
  const formattedEffectiveDate = details.openingBalance?.effectiveDate
    ? format(parseOptionalIsoDate(details.openingBalance.effectiveDate) ?? new Date(), "PPP", {
        locale: getDateFnsLocale(locale),
      })
    : t("financialAccounts.labels.noBillingDay");

  return (
    <ScreenLayout
      title={t("financialAccounts.detail.title")}
      variant="sub"
      onBack={() => router.back()}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroCard, { backgroundColor: accentGreenLight }]}>
          <View style={styles.heroHeader}>
            <View style={styles.heroText}>
              <Text style={[styles.heroTitle, { color: primary }]}>{details.account.name}</Text>
              <Text style={[styles.heroSubtitle, { color: secondary }]}>
                {t(`financialAccounts.kinds.${kind}`)}
              </Text>
            </View>

            {details.account.isDefault ? (
              <View style={[styles.badge, { backgroundColor: "#FFFFFFAA" }]}>
                <Text style={[styles.badgeText, { color: accentGreen }]}>
                  {t("financialAccounts.labels.default")}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {details.hasBillingProfileGap ? (
          <View style={[styles.warningBanner, { borderColor: accentRed }]}>
            <TriangleAlert size={18} color={accentRed} />
            <View style={styles.warningCopy}>
              <Text style={[styles.warningTitle, { color: primary }]}>
                {t("financialAccounts.detail.billingGapTitle")}
              </Text>
              <Text style={[styles.warningBody, { color: secondary }]}>
                {t("financialAccounts.detail.billingGapBody")}
              </Text>
            </View>
          </View>
        ) : null}

        <DetailSection title={t("financialAccounts.detail.accountSection")}>
          <FieldRow
            label={t("financialAccounts.detail.kindLabel")}
            value={t(`financialAccounts.kinds.${kind}`)}
          />
          <FieldRow
            label={t("financialAccounts.detail.defaultLabel")}
            value={
              details.account.isDefault
                ? t("financialAccounts.labels.default")
                : t("financialAccounts.labels.notDefault")
            }
          />
        </DetailSection>

        <DetailSection title={t("financialAccounts.detail.openingBalanceSection")}>
          <FieldRow
            label={
              isCreditCard
                ? t("financialAccounts.detail.startingDebtLabel")
                : t("financialAccounts.detail.openingBalanceLabel")
            }
            value={
              details.openingBalance
                ? formatMoney(details.openingBalance.amount)
                : t("financialAccounts.labels.noOpeningBalance")
            }
          />
          <FieldRow
            label={t("financialAccounts.detail.effectiveDateLabel")}
            value={formattedEffectiveDate}
          />
        </DetailSection>

        {isCreditCard ? (
          <DetailSection title={t("financialAccounts.detail.billingProfileTitle")}>
            <FieldRow
              label={t("financialAccounts.form.statementClosingDay")}
              value={
                details.account.statementClosingDay?.toString() ??
                t("financialAccounts.labels.noBillingDay")
              }
            />
            <FieldRow
              label={t("financialAccounts.form.paymentDueDay")}
              value={
                details.account.paymentDueDay?.toString() ??
                t("financialAccounts.labels.noBillingDay")
              }
            />
          </DetailSection>
        ) : null}

        <DetailSection title={t("financialAccounts.detail.identifiersTitle")}>
          {details.identifiers.length > 0 ? (
            <View style={styles.identifierWrap}>
              {details.identifiers.map((identifier) => (
                <IdentifierChip key={identifier.id} value={identifier.value} />
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyIdentifiers, { color: secondary }]}>
              {t("financialAccounts.detail.identifiersEmpty")}
            </Text>
          )}

          <Pressable
            style={styles.manageButton}
            onPress={() =>
              router.push({
                pathname: "/financial-account-identifier",
                params: { accountId: details.account.id },
              })
            }
          >
            <Text style={[styles.manageButtonText, { color: primary }]}>
              {t("financialAccounts.detail.manageIdentifiers")}
            </Text>
            <ChevronRight size={16} color={secondary} />
          </Pressable>
        </DetailSection>

        <Pressable
          style={[styles.primaryButton, { backgroundColor: accentGreen }]}
          onPress={() =>
            router.push({
              pathname: "/financial-account-form",
              params: { accountId: details.account.id },
            })
          }
        >
          <Text style={styles.primaryButtonText}>{t("financialAccounts.detail.editCta")}</Text>
        </Pressable>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 18,
  },
  heroCard: {
    borderRadius: 22,
    padding: 18,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  heroText: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 21,
  },
  heroSubtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  warningBanner: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  warningCopy: {
    flex: 1,
    gap: 3,
  },
  warningTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 13,
  },
  warningBody: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
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
    overflow: "hidden",
  },
  fieldRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fieldLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
  },
  fieldValue: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
  identifierWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
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
  emptyIdentifiers: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  manageButton: {
    minHeight: 46,
    paddingHorizontal: 16,
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
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
  },
});
