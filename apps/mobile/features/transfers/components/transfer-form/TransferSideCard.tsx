import type { FinancialAccountRow } from "@/features/financial-accounts";
import { readFinancialAccountKind } from "@/features/financial-accounts/lib/kind";
import type { TransferSide } from "@/features/transfers/lib/build-transfer";
import { ChevronRight, ExternalLink, Landmark } from "@/shared/components/icons";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { formatMoney } from "@/shared/lib";
import { getKindIcon } from "./TransferForm.helpers";
import { styles } from "./TransferForm.styles";
import type { AccountBalanceMap } from "./TransferForm.types";

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
  const borderSubtle = useThemeColor("borderSubtle");
  const card = useThemeColor("card");
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const peachLight = useThemeColor("peachLight");
  const accountId = props.side?.kind === "account" ? props.side.accountId : null;
  const account = accountId ? props.accounts.find((item) => item.id === accountId) : null;
  const kind = account ? readFinancialAccountKind(account.kind) : null;
  const Icon =
    props.side?.kind === "external" ? ExternalLink : account ? getKindIcon(account.kind) : Landmark;
  const sideBalance = account ? (props.balances[account.id] ?? 0) : null;
  const title =
    props.side == null
      ? t("transfers.chooseSide")
      : props.side.kind === "external"
        ? t("transfers.outsideFidy")
        : (account?.name ?? t("common.unknown"));
  const subtitle =
    props.side == null
      ? t("transfers.chooseSideHint")
      : props.side.kind === "external"
        ? t("transfers.outsideFidyDescription")
        : account
          ? t(`financialAccounts.kinds.${kind}`)
          : t("common.unknown");

  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.sectionLabel, { color: primary }]}>{props.label}</Text>
      <Pressable
        onPress={props.onPress}
        testID={props.testID}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t("transfers.a11y.selectSide", { side: props.label })}
        accessibilityHint={subtitle}
        style={[
          styles.sideCard,
          {
            borderColor: props.isConflict ? accentRed : borderSubtle,
            backgroundColor: props.side?.kind === "external" ? peachLight : card,
          },
        ]}
      >
        <View
          style={[
            styles.sideIconWrap,
            {
              backgroundColor: props.side?.kind === "external" ? "#FFFFFFAA" : peachLight,
            },
          ]}
        >
          <Icon size={18} color={props.side?.kind === "external" ? accentGreen : secondary} />
        </View>

        <View style={styles.sideTextWrap}>
          <Text style={[styles.sideTitle, { color: primary }]}>{title}</Text>
          <Text style={[styles.sideSubtitle, { color: secondary }]}>{subtitle}</Text>
        </View>

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
      </Pressable>
    </View>
  );
}
