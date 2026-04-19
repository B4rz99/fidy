import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useOptionalUserId } from "@/features/auth";
import {
  type FinancialAccountKind,
  type FinancialAccountRow,
  getFinancialAccountsForUser,
} from "@/features/financial-accounts";
import { readFinancialAccountKind } from "@/features/financial-accounts/lib/kind";
import { createFinancialAccountManagementService } from "@/features/financial-accounts/lib/management-service";
import { ScreenLayout } from "@/shared/components";
import {
  ChevronRight,
  CreditCard,
  Landmark,
  PiggyBank,
  Plus,
  Wallet,
} from "@/shared/components/icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useThemeColor, useTranslation } from "@/shared/hooks";

const managementService = createFinancialAccountManagementService();

type FinancialAccountListItem = {
  readonly account: FinancialAccountRow;
  readonly identifiersCount: number;
  readonly hasBillingProfileGap: boolean;
};

function getKindIcon(kind: FinancialAccountKind) {
  if (kind === "credit_card") return CreditCard;
  if (kind === "wallet" || kind === "cash") return Wallet;
  if (kind === "savings") return PiggyBank;
  return Landmark;
}

function AccountRow({
  item,
  onPress,
}: {
  readonly item: FinancialAccountListItem;
  readonly onPress: () => void;
}) {
  const { t } = useTranslation();
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const borderSubtle = useThemeColor("borderSubtle");
  const accentRed = useThemeColor("accentRed");
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");
  const peachLight = useThemeColor("peachLight");
  const kind = readFinancialAccountKind(item.account.kind);
  const Icon = getKindIcon(kind);
  const subtitleParts = [
    t(`financialAccounts.kinds.${kind}`),
    item.identifiersCount > 0
      ? t("financialAccounts.list.identifiersCount", { count: item.identifiersCount })
      : null,
  ].filter((value): value is string => value != null);

  return (
    <Pressable
      style={[styles.row, { borderColor: borderSubtle }]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: kind === "credit_card" ? peachLight : accentGreenLight },
        ]}
      >
        <Icon size={18} color={kind === "credit_card" ? accentRed : accentGreen} />
      </View>

      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <Text style={[styles.rowTitle, { color: primary }]}>{item.account.name}</Text>
          {item.account.isDefault ? (
            <View style={[styles.badge, { backgroundColor: accentGreenLight }]}>
              <Text style={[styles.badgeText, { color: accentGreen }]}>
                {t("financialAccounts.labels.default")}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles.rowSubtitle, { color: secondary }]}>{subtitleParts.join(" • ")}</Text>

        {item.hasBillingProfileGap ? (
          <Text style={[styles.rowWarning, { color: accentRed }]}>
            {t("financialAccounts.list.billingGap")}
          </Text>
        ) : null}
      </View>

      <ChevronRight size={18} color={tertiary} />
    </Pressable>
  );
}

export function FinancialAccountsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const secondary = useThemeColor("secondary");
  const primary = useThemeColor("primary");
  const accentGreen = useThemeColor("accentGreen");
  const [items, setItems] = useState<readonly FinancialAccountListItem[]>([]);

  const reloadAccounts = useCallback(() => {
    if (!db || !userId) {
      setItems([]);
      return;
    }

    const nextItems = getFinancialAccountsForUser(db, userId).map((account) => {
      const details = managementService.getAccountDetails({ db, accountId: account.id });

      return {
        account,
        identifiersCount: details?.identifiers.length ?? 0,
        hasBillingProfileGap: details?.hasBillingProfileGap ?? false,
      } satisfies FinancialAccountListItem;
    });

    setItems(nextItems);
  }, [db, userId]);

  useFocusEffect(reloadAccounts);

  const regularAccounts = items.filter(
    (item) => readFinancialAccountKind(item.account.kind) !== "credit_card"
  );
  const creditCardAccounts = items.filter(
    (item) => readFinancialAccountKind(item.account.kind) === "credit_card"
  );

  return (
    <ScreenLayout
      title={t("financialAccounts.list.title")}
      variant="sub"
      onBack={() => router.back()}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.subtitle, { color: secondary }]}>
          {t("financialAccounts.list.subtitle")}
        </Text>

        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: primary }]}>
              {t("financialAccounts.list.emptyTitle")}
            </Text>
            <Text style={[styles.emptySubtitle, { color: secondary }]}>
              {t("financialAccounts.list.emptySubtitle")}
            </Text>
          </View>
        ) : (
          <>
            {regularAccounts.length > 0 ? (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: secondary }]}>
                  {t("financialAccounts.list.regularSection")}
                </Text>
                {regularAccounts.map((item) => (
                  <AccountRow
                    key={item.account.id}
                    item={item}
                    onPress={() =>
                      router.push({
                        pathname: "/financial-account-details",
                        params: { accountId: item.account.id },
                      })
                    }
                  />
                ))}
              </View>
            ) : null}

            {creditCardAccounts.length > 0 ? (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: secondary }]}>
                  {t("financialAccounts.list.creditSection")}
                </Text>
                {creditCardAccounts.map((item) => (
                  <AccountRow
                    key={item.account.id}
                    item={item}
                    onPress={() =>
                      router.push({
                        pathname: "/financial-account-details",
                        params: { accountId: item.account.id },
                      })
                    }
                  />
                ))}
              </View>
            ) : null}
          </>
        )}

        <Pressable
          style={[styles.primaryButton, { backgroundColor: accentGreen }]}
          onPress={() => router.push("/financial-account-form")}
        >
          <Plus size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>{t("financialAccounts.list.addCta")}</Text>
        </Pressable>
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 20,
  },
  subtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    lineHeight: 19,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontFamily: "Poppins_700Bold",
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  row: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: {
    flex: 1,
    gap: 3,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  rowTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
  },
  rowSubtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  rowWarning: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 40,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
  },
});
