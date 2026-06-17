import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AddActionButton } from "@/shared/components";
import { EmptyState } from "@/shared/components/EmptyState";
import { ScreenLayout } from "@/shared/components/ScreenLayout";
import { ScrollView, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { styles } from "./FinancialAccountsScreen.styles";
import type { FinancialAccountListItem } from "./FinancialAccountsScreen.types";
import { FinancialAccountsSection } from "./FinancialAccountsSection";

function FinancialAccountAddButton({
  accessibilityLabel,
  onPress,
}: {
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
}) {
  return <AddActionButton accessibilityLabel={accessibilityLabel} onPress={onPress} />;
}

function FinancialAccountsAuroraLayer() {
  return <View pointerEvents="none" style={styles.auroraLayer} />;
}

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
  const title = t("financialAccounts.list.title");
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const { bottom } = useSafeAreaInsets();
  const hasItems = regularAccounts.length + creditCardAccounts.length > 0;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenLayout
        variant="sub"
        includesNativeHeader={false}
        centerAction={
          <Text style={[styles.headerTitle, { color: primary }]} numberOfLines={1}>
            {title}
          </Text>
        }
        backgroundLayer={<FinancialAccountsAuroraLayer />}
        onBack={onBack}
        rightActions={
          <FinancialAccountAddButton
            accessibilityLabel={t("financialAccounts.list.addLabel")}
            onPress={onAddAccount}
          />
        }
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.content, { paddingBottom: bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.introCopy, { color: secondary }]}>
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
            <EmptyState
              title={t("financialAccounts.list.emptyTitle")}
              subtitle={t("financialAccounts.list.emptySubtitle")}
              className="py-12"
            />
          )}
        </ScrollView>
      </ScreenLayout>
    </>
  );
}
