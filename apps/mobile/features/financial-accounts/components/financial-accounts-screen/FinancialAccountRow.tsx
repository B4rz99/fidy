import { readFinancialAccountKind } from "@/features/financial-accounts/lib/kind";
import type { FinancialAccountKind } from "@/features/financial-accounts/schema";
import { ChevronRight, CreditCard, Landmark, PiggyBank, Wallet } from "@/shared/components/icons";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { styles } from "./FinancialAccountsScreen.styles";
import type { FinancialAccountListItem } from "./FinancialAccountsScreen.types";

function getKindIcon(kind: FinancialAccountKind) {
  if (kind === "credit_card") return CreditCard;
  if (kind === "wallet" || kind === "cash") return Wallet;
  if (kind === "savings") return PiggyBank;
  return Landmark;
}

export function FinancialAccountRow({
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
