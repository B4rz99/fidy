import {
  canFinancialAccountHaveIdentifiers,
  readFinancialAccountKind,
} from "@/features/financial-accounts/display.public";
import type { FinancialAccountKind } from "@/features/financial-accounts/schema";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { styles } from "./FinancialAccountsScreen.styles";
import type { FinancialAccountListItem } from "./FinancialAccountsScreen.types";

function getKindIcon(kind: FinancialAccountKind) {
  switch (kind) {
    case "checking":
      return "🏦";
    case "savings":
      return "🐷";
    case "wallet":
      return "👛";
    case "cash":
      return "💵";
    case "credit_card":
      return "💳";
    default: {
      const exhaustiveKind: never = kind;
      return exhaustiveKind;
    }
  }
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
  const card = useThemeColor("card");
  const borderSubtle = useThemeColor("borderSubtle");
  const accentRed = useThemeColor("accentRed");
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");
  const peach = useThemeColor("peach");
  const peachLight = useThemeColor("peachLight");
  const chartBg = useThemeColor("chartBg");
  const numpadKey = useThemeColor("numpadKey");
  const numpadSpecialKey = useThemeColor("numpadSpecialKey");
  const kind = readFinancialAccountKind(item.account.kind);
  const icon = getKindIcon(kind);
  const iconPalette = {
    checking: { backgroundColor: accentGreenLight, color: accentGreen },
    savings: { backgroundColor: peachLight, color: peach },
    wallet: { backgroundColor: chartBg, color: secondary },
    cash: { backgroundColor: numpadKey, color: tertiary },
    credit_card: { backgroundColor: numpadSpecialKey, color: peach },
  } satisfies Record<
    FinancialAccountKind,
    { readonly backgroundColor: string; readonly color: string }
  >;
  const subtitleParts = [
    t(`financialAccounts.kinds.${kind}`),
    canFinancialAccountHaveIdentifiers(kind) && item.identifiersCount > 0
      ? t("financialAccounts.list.identifiersCount", { count: item.identifiersCount })
      : null,
  ].filter((value): value is string => value != null);

  return (
    <Pressable
      style={[styles.accountCard, { backgroundColor: card, borderColor: borderSubtle }]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={[styles.accountIcon, { backgroundColor: iconPalette[kind].backgroundColor }]}>
        <Text style={{ color: iconPalette[kind].color }}>{icon}</Text>
      </View>

      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <Text style={[styles.rowTitle, { color: primary }]}>{item.account.name}</Text>
          {item.account.isDefault ? (
            <View style={[styles.badge, { backgroundColor: accentGreenLight }]}>
              <Text style={[styles.badgeText, { color: primary }]}>
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

      <Text style={{ color: tertiary }}>›</Text>
    </Pressable>
  );
}
