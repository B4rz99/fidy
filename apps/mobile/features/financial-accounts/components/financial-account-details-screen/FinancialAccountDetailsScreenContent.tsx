import { ScreenLayout } from "@/shared/components";
import { TriangleAlert } from "@/shared/components/icons";
import { Pressable, ScrollView, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { formatMoney } from "@/shared/lib";
import {
  FinancialAccountDetailSection,
  FinancialAccountFieldRow,
} from "./FinancialAccountDetailSection";
import {
  formatOpeningBalanceEffectiveDate,
  getOpeningBalanceLabelKey,
} from "./FinancialAccountDetails.helpers";
import { FinancialAccountDetailsHero } from "./FinancialAccountDetailsHero";
import { styles } from "./FinancialAccountDetailsScreen.styles";
import { FinancialAccountIdentifiersSection } from "./FinancialAccountIdentifiersSection";
import type { UseFinancialAccountDetailsScreenResult } from "./useFinancialAccountDetailsScreen";

export function FinancialAccountDetailsScreenContent({
  accountId,
  details,
  kind,
  onBack,
  onEditAccount,
  onManageIdentifiers,
}: UseFinancialAccountDetailsScreenResult) {
  const { t, locale } = useTranslation();
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const accentRed = useThemeColor("accentRed");
  const accentGreen = useThemeColor("accentGreen");

  if (!accountId) {
    return null;
  }

  if (!details || !kind) {
    return (
      <ScreenLayout title={t("financialAccounts.detail.title")} variant="sub" onBack={onBack}>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: primary }]}>
            {t("financialAccounts.list.emptyTitle")}
          </Text>
        </View>
      </ScreenLayout>
    );
  }

  const isCreditCard = kind === "credit_card";
  const kindLabel = t(`financialAccounts.kinds.${kind}`);
  const formattedEffectiveDate = formatOpeningBalanceEffectiveDate({
    effectiveDate: details.openingBalance?.effectiveDate,
    fallback: t("financialAccounts.labels.noBillingDay"),
    locale,
  });

  return (
    <ScreenLayout title={t("financialAccounts.detail.title")} variant="sub" onBack={onBack}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <FinancialAccountDetailsHero
          isDefault={details.account.isDefault === true}
          kindLabel={kindLabel}
          name={details.account.name}
        />

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

        <FinancialAccountDetailSection title={t("financialAccounts.detail.accountSection")}>
          <FinancialAccountFieldRow
            label={t("financialAccounts.detail.kindLabel")}
            value={kindLabel}
          />
          <FinancialAccountFieldRow
            label={t("financialAccounts.detail.defaultLabel")}
            value={
              details.account.isDefault
                ? t("financialAccounts.labels.default")
                : t("financialAccounts.labels.notDefault")
            }
          />
        </FinancialAccountDetailSection>

        <FinancialAccountDetailSection title={t("financialAccounts.detail.openingBalanceSection")}>
          <FinancialAccountFieldRow
            label={t(getOpeningBalanceLabelKey(kind))}
            value={
              details.openingBalance
                ? formatMoney(details.openingBalance.amount)
                : t("financialAccounts.labels.noOpeningBalance")
            }
          />
          <FinancialAccountFieldRow
            label={t("financialAccounts.detail.effectiveDateLabel")}
            value={formattedEffectiveDate}
          />
        </FinancialAccountDetailSection>

        {isCreditCard ? (
          <FinancialAccountDetailSection title={t("financialAccounts.detail.billingProfileTitle")}>
            <FinancialAccountFieldRow
              label={t("financialAccounts.form.statementClosingDay")}
              value={
                details.account.statementClosingDay?.toString() ??
                t("financialAccounts.labels.noBillingDay")
              }
            />
            <FinancialAccountFieldRow
              label={t("financialAccounts.form.paymentDueDay")}
              value={
                details.account.paymentDueDay?.toString() ??
                t("financialAccounts.labels.noBillingDay")
              }
            />
          </FinancialAccountDetailSection>
        ) : null}

        <FinancialAccountIdentifiersSection
          identifiers={details.identifiers}
          onManageIdentifiers={onManageIdentifiers}
        />

        <Pressable
          style={[styles.primaryButton, { backgroundColor: accentGreen }]}
          onPress={onEditAccount}
        >
          <Text style={styles.primaryButtonText}>{t("financialAccounts.detail.editCta")}</Text>
        </Pressable>
      </ScrollView>
    </ScreenLayout>
  );
}
