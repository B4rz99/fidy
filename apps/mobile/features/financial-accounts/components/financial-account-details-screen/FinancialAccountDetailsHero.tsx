import { Surface } from "@/shared/components";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { styles } from "./FinancialAccountDetailsScreen.styles";

export function FinancialAccountDetailsHero({
  isDefault,
  kindLabel,
  name,
}: {
  readonly isDefault: boolean;
  readonly kindLabel: string;
  readonly name: string;
}) {
  const { t } = useTranslation();
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const accentGreenLight = useThemeColor("accentGreenLight");

  return (
    <Surface padded={false} radius={22} style={styles.heroCard}>
      <View style={styles.heroHeader}>
        <View style={styles.heroText}>
          <Text style={[styles.heroTitle, { color: primary }]}>{name}</Text>
          <Text style={[styles.heroSubtitle, { color: secondary }]}>{kindLabel}</Text>
        </View>

        {isDefault ? (
          <View style={[styles.badge, { backgroundColor: primary }]}>
            <Text style={[styles.badgeText, { color: accentGreenLight }]}>
              {t("financialAccounts.labels.default")}
            </Text>
          </View>
        ) : null}
      </View>
    </Surface>
  );
}
