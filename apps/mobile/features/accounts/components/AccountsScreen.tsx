import { useRouter } from "expo-router";
import { ScreenLayout, TAB_BAR_CLEARANCE } from "@/shared/components";
import { Plus } from "@/shared/components/icons";
import { Pressable, ScrollView, Text, View } from "@/shared/components/rn";
import { useMountEffect, useThemeColor, useTranslation } from "@/shared/hooks";
import { formatMoney } from "@/shared/lib";
import { getAccountSubtypeLabelKey } from "../lib/create-account";
import type { Account } from "../schema";
import { useAccountsStore } from "../store";

export function AccountsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const accounts = useAccountsStore((s) => s.accounts);
  const refresh = useAccountsStore((s) => s.refresh);

  const accentGreen = useThemeColor("accentGreen");
  const borderColor = useThemeColor("borderSubtle");

  useMountEffect(() => {
    void refresh();
  });

  return (
    <ScreenLayout title={t("accounts.title")} variant="sub" onBack={() => router.back()}>
      <ScrollView
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: TAB_BAR_CLEARANCE,
          gap: 16,
        }}
      >
        <Text
          className="font-poppins-medium text-label text-secondary dark:text-secondary-dark"
          style={{ lineHeight: 20 }}
        >
          {t("accounts.subtitle")}
        </Text>

        <Pressable
          onPress={() => router.push("/create-account")}
          className="flex-row items-center justify-center rounded-icon"
          style={{
            minHeight: 48,
            backgroundColor: accentGreen,
            gap: 8,
          }}
        >
          <Plus size={18} color="#FFFFFF" />
          <Text className="font-poppins-semibold text-body" style={{ color: "#FFFFFF" }}>
            {t("accounts.add")}
          </Text>
        </Pressable>

        {accounts.length === 0 ? (
          <View
            className="rounded-chart bg-card p-5 dark:bg-card-dark"
            style={{
              borderWidth: 1,
              borderColor,
              gap: 8,
            }}
          >
            <Text className="font-poppins-semibold text-section text-primary dark:text-primary-dark">
              {t("accounts.emptyTitle")}
            </Text>
            <Text
              className="font-poppins text-label text-secondary dark:text-secondary-dark"
              style={{ lineHeight: 20 }}
            >
              {t("accounts.emptySubtitle")}
            </Text>
          </View>
        ) : (
          accounts.map((account) => <AccountCard key={account.id} account={account} />)
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

function AccountCard({ account }: { readonly account: Account }) {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const borderColor = useThemeColor("borderSubtle");

  return (
    <View
      className="rounded-chart bg-card p-5 dark:bg-card-dark"
      style={{
        borderWidth: 1,
        borderColor,
        gap: 12,
      }}
    >
      <View className="flex-row items-start justify-between" style={{ gap: 12 }}>
        <View className="flex-1" style={{ gap: 4 }}>
          <Text className="font-poppins-semibold text-section text-primary dark:text-primary-dark">
            {account.name}
          </Text>
          <Text className="font-poppins text-label text-secondary dark:text-secondary-dark">
            {account.institution}
          </Text>
        </View>
        <View
          className="rounded-lg px-2.5 py-1"
          style={{
            backgroundColor: `${accentGreen}20`,
          }}
        >
          <Text className="font-poppins-semibold text-[11px] text-accent-green dark:text-accent-green-dark">
            {t(getAccountSubtypeLabelKey(account.accountSubtype))}
          </Text>
        </View>
      </View>

      <View style={{ gap: 2 }}>
        <Text className="font-poppins-medium text-caption text-tertiary dark:text-tertiary-dark">
          {t("accounts.openingBalance")}
        </Text>
        <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
          {formatMoney(account.baselineAmount)}
        </Text>
      </View>
    </View>
  );
}
