import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenLayout } from "@/shared/components";
import { Plus } from "@/shared/components/icons";
import { Pressable, ScrollView, Text, View } from "@/shared/components/rn";
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
  const primary = useThemeColor("primary");

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={12}
      onPress={onPress}
      style={styles.headerAddButton}
    >
      <Plus size={22} color={primary} />
    </Pressable>
  );
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
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: primary }]}>
                {t("financialAccounts.list.emptyTitle")}
              </Text>
              <Text style={[styles.emptySubtitle, { color: secondary }]}>
                {t("financialAccounts.list.emptySubtitle")}
              </Text>
            </View>
          )}
        </ScrollView>
      </ScreenLayout>
    </>
  );
}
