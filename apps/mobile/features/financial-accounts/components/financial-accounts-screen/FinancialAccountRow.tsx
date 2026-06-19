import {
  canFinancialAccountHaveIdentifiers,
  readFinancialAccountKind,
} from "@/features/financial-accounts/display.public";
import type { FinancialAccountKind } from "@/features/financial-accounts/schema";
import { FieldSurface } from "@/shared/components/FieldSurface";
import { ListRowSurface } from "@/shared/components/ListRowSurface";
import { Text, View } from "@/shared/components/rn";
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
  const accentRed = useThemeColor("accentRed");
  const kind = readFinancialAccountKind(item.account.kind);
  const icon = getKindIcon(kind);
  const subtitleParts = [
    t(`financialAccounts.kinds.${kind}`),
    canFinancialAccountHaveIdentifiers(kind) && item.identifiersCount > 0
      ? t("financialAccounts.list.identifiersCount", { count: item.identifiersCount })
      : null,
  ].filter((value): value is string => value != null);

  return (
    <ListRowSurface
      onPress={onPress}
      accessibilityRole="button"
      radius={22}
      contentStyle={styles.accountCard}
    >
      <View style={styles.accountIcon}>
        <Text>{icon}</Text>
      </View>

      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <Text style={[styles.rowTitle, { color: primary }]}>{item.account.name}</Text>
          {item.account.isDefault ? (
            <FieldSurface
              radius={999}
              size="compact"
              style={styles.badge}
              contentStyle={styles.badgeContent}
            >
              <Text style={[styles.badgeText, { color: primary }]}>
                {t("financialAccounts.labels.default")}
              </Text>
            </FieldSurface>
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
    </ListRowSurface>
  );
}
