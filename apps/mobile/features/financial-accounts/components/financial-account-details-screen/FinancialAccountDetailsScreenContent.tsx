import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Callout, EmptyState, ScreenLayout } from "@/shared/components";
import { TriangleAlert } from "@/shared/components/icons";
import { ScrollView } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { formatMoney } from "@/shared/lib";
import { canFinancialAccountHaveIdentifiers } from "../../lib/kind";
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
  const accentRed = useThemeColor("accentRed");
  const { bottom } = useSafeAreaInsets();

  if (!accountId || !details || !kind) {
    return (
      <ScreenLayout title={t("financialAccounts.detail.title")} variant="sub" onBack={onBack}>
        <EmptyState title={t("financialAccounts.list.emptyTitle")} />
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
        contentContainerStyle={[styles.content, { paddingBottom: bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <FinancialAccountDetailsHero
          isDefault={details.account.isDefault === true}
          kindLabel={kindLabel}
          name={details.account.name}
        />

        {details.hasBillingProfileGap ? (
          <Callout
            title={t("financialAccounts.detail.billingGapTitle")}
            subtitle={t("financialAccounts.detail.billingGapBody")}
            icon={<TriangleAlert size={18} color={accentRed} />}
            tone="danger"
          />
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
            isLast
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
            isLast
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
              isLast
            />
          </FinancialAccountDetailSection>
        ) : null}

        {canFinancialAccountHaveIdentifiers(kind) ? (
          <FinancialAccountIdentifiersSection
            identifiers={details.identifiers}
            onManageIdentifiers={onManageIdentifiers}
          />
        ) : null}

        <Button label={t("financialAccounts.detail.editCta")} onPress={onEditAccount} />
      </ScrollView>
    </ScreenLayout>
  );
}
