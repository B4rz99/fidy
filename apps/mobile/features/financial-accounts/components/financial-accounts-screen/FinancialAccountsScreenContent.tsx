import { ScreenLayout } from "@/shared/components";
import { Plus } from "@/shared/components/icons";
import { Pressable, ScrollView, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { styles } from "./FinancialAccountsScreen.styles";
import type { FinancialAccountListItem } from "./FinancialAccountsScreen.types";
import { FinancialAccountsSection } from "./FinancialAccountsSection";

export function FinancialAccountsScreenContent({
  creditCardAccounts,
  onAddAccount,
  onBack,
  onOpenAccount,
  regularAccounts,
}: {
  readonly creditCardAccounts: readonly FinancialAccountListItem[];
  readonly onAddAccount: () => void;
  readonly onBack: () => void;
  readonly onOpenAccount: (accountId: FinancialAccountListItem["account"]["id"]) => void;
  readonly regularAccounts: readonly FinancialAccountListItem[];
}) {
  const { t } = useTranslation();
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");
  const hasItems = regularAccounts.length + creditCardAccounts.length > 0;

  return (
    <ScreenLayout title={t("financialAccounts.list.title")} variant="sub" onBack={onBack}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.subtitle, { color: secondary }]}>
          {t("financialAccounts.list.subtitle")}
        </Text>

        {hasItems ? (
          <>
            <FinancialAccountsSection
              label={t("financialAccounts.list.regularSection")}
              items={regularAccounts}
              onOpenAccount={onOpenAccount}
            />
            <FinancialAccountsSection
              label={t("financialAccounts.list.creditSection")}
              items={creditCardAccounts}
              onOpenAccount={onOpenAccount}
            />
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: primary }]}>
              {t("financialAccounts.list.emptyTitle")}
            </Text>
            <Text style={[styles.emptySubtitle, { color: secondary }]}>
              {t("financialAccounts.list.emptySubtitle")}
            </Text>
          </View>
        )}

        <Pressable
          style={[styles.primaryButton, { backgroundColor: accentGreen }]}
          onPress={onAddAccount}
        >
          <Plus size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>{t("financialAccounts.list.addCta")}</Text>
        </Pressable>
      </ScrollView>
    </ScreenLayout>
  );
}
