import { readFinancialAccountKind } from "@/features/financial-accounts/display.public";
import type { FinancialAccountRow } from "@/features/financial-accounts/public";
import type { TransferSide } from "@/features/transfers/build.public";
import { FieldButton, GlassSurface } from "@/shared/components";
import { ChevronRight, ExternalLink, Landmark } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { formatMoney } from "@/shared/lib";
import { getKindIcon } from "./TransferForm.helpers";
import { styles } from "./TransferForm.styles";
import type { AccountBalanceMap } from "./TransferForm.types";

function getSideTitle(
  side: TransferSide | null,
  account: FinancialAccountRow | null | undefined,
  t: ReturnType<typeof useTranslation>["t"]
): string {
  if (side == null) return t("transfers.chooseSide");
  if (side.kind === "external") return t("transfers.outsideFidy");
  return account?.name ?? t("common.unknown");
}

function getSideSubtitle(
  side: TransferSide | null,
  account: FinancialAccountRow | null | undefined,
  t: ReturnType<typeof useTranslation>["t"]
): string {
  if (side == null) return t("transfers.chooseSideHint");
  if (side.kind === "external") return t("transfers.outsideFidyDescription");
  if (account) return t(`financialAccounts.kinds.${readFinancialAccountKind(account.kind)}`);
  return t("common.unknown");
}

export function TransferSideCard(props: {
  readonly accounts: readonly FinancialAccountRow[];
  readonly balances: AccountBalanceMap;
  readonly isConflict: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly side: TransferSide | null;
  // biome-ignore lint/style/useNamingConvention: React Native prop name
  readonly testID: string;
}) {
  const { t } = useTranslation();
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const accountId = props.side?.kind === "account" ? props.side.accountId : null;
  const account = accountId ? props.accounts.find((item) => item.id === accountId) : null;
  const Icon = (() => {
    if (props.side?.kind === "external") return ExternalLink;
    if (account) return getKindIcon(account.kind);
    return Landmark;
  })();
  const sideBalance = account ? (props.balances[account.id] ?? 0) : null;
  const title = getSideTitle(props.side, account, t);
  const subtitle = getSideSubtitle(props.side, account, t);

  return (
    <View style={{ gap: 8 }}>
      <FieldButton
        label={props.label}
        value={
          <View style={styles.sideTextWrap}>
            <Text style={[styles.sideTitle, { color: primary }]}>{title}</Text>
            <Text style={[styles.sideSubtitle, { color: secondary }]}>{subtitle}</Text>
          </View>
        }
        leading={
          <GlassSurface radius={12} padded={false} style={styles.sideIconWrap}>
            <Icon size={18} color={props.side?.kind === "external" ? accentGreen : secondary} />
          </GlassSurface>
        }
        trailing={
          <View className="flex-row items-center" style={{ gap: 8 }}>
            {sideBalance != null ? (
              <Text
                style={[
                  styles.sideTitle,
                  {
                    color: sideBalance < 0 ? accentRed : primary,
                  },
                ]}
              >
                {formatMoney(sideBalance)}
              </Text>
            ) : null}
            <ChevronRight size={18} color={tertiary} />
          </View>
        }
        onPress={props.onPress}
        testID={props.testID}
        accessible
        accessibilityLabel={t("transfers.a11y.selectSide", { side: props.label })}
        accessibilityHint={subtitle}
        buttonStyle={{
          minHeight: 74,
          paddingVertical: 12,
        }}
      />
    </View>
  );
}
