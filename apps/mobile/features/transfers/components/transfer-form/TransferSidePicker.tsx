import { readFinancialAccountKind } from "@/features/financial-accounts/display.public";
import type { FinancialAccountRow } from "@/features/financial-accounts/public";
import type { TransferSide } from "@/features/transfers/build.public";
import { OUTSIDE_FIDY_LABEL } from "@/features/transfers/build.public";
import { isTransferSideSelected } from "@/features/transfers/display.public";
import { PickerDialog, PickerOptionRow } from "@/shared/components";
import { ChevronRight, ExternalLink } from "@/shared/components/icons";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { formatMoney } from "@/shared/lib";
import { getKindIcon } from "./TransferForm.helpers";
import { styles } from "./TransferForm.styles";
import type { AccountBalanceMap, PickerTarget } from "./TransferForm.types";
import { TRANSFER_FORM_TEST_IDS } from "./TransferForm.types";

export function TransferSidePicker(props: {
  readonly accounts: readonly FinancialAccountRow[];
  readonly balances: AccountBalanceMap;
  readonly currentSide: TransferSide | null;
  readonly onClose: () => void;
  readonly onSelect: (target: PickerTarget, side: TransferSide) => void;
  readonly target: PickerTarget | null;
  readonly visible: boolean;
}) {
  const { t } = useTranslation();
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const peachLight = useThemeColor("peachLight");

  return (
    <PickerDialog
      visible={props.visible}
      testID={TRANSFER_FORM_TEST_IDS.pickerDialog}
      title={t("transfers.pickerTitle")}
      subtitle={
        <Text style={[styles.pickerSubtitle, { color: secondary }]}>
          {t("transfers.pickerSubtitle")}
        </Text>
      }
      showHandle
      showCancel={false}
      onClose={props.onClose}
    >
      {props.accounts.map((account) => {
        const kind = readFinancialAccountKind(account.kind);
        const balance = props.balances[account.id] ?? 0;
        const isSelected = isTransferSideSelected(props.currentSide, account.id);
        const Icon = getKindIcon(account.kind);

        return (
          <PickerOptionRow
            key={account.id}
            testID={`${TRANSFER_FORM_TEST_IDS.pickerAccountPrefix}${account.id}`}
            onPress={() =>
              props.target &&
              props.onSelect(props.target, { kind: "account", accountId: account.id })
            }
            accessibilityLabel={account.name}
            accessibilityHint={t(`financialAccounts.kinds.${kind}`)}
            selected={isSelected}
            leading={
              <View style={[styles.sideIconWrap, { backgroundColor: peachLight }]}>
                <Icon size={18} color={secondary} />
              </View>
            }
            title={account.name}
            subtitle={t(`financialAccounts.kinds.${kind}`)}
            trailing={
              <View className="flex-row items-center" style={{ gap: 8 }}>
                <Text
                  style={[
                    styles.sideTitle,
                    {
                      color: balance < 0 ? accentRed : primary,
                    },
                  ]}
                >
                  {formatMoney(balance)}
                </Text>
                <ChevronRight size={18} color={tertiary} />
              </View>
            }
          />
        );
      })}

      <PickerOptionRow
        testID={TRANSFER_FORM_TEST_IDS.pickerOutsideFidy}
        onPress={() =>
          props.target &&
          props.onSelect(props.target, { kind: "external", label: OUTSIDE_FIDY_LABEL })
        }
        accessibilityLabel={t("transfers.outsideFidy")}
        accessibilityHint={t("transfers.outsideFidyDescription")}
        leading={
          <View style={[styles.sideIconWrap, { backgroundColor: peachLight }]}>
            <ExternalLink size={18} color={accentGreen} />
          </View>
        }
        title={t("transfers.outsideFidy")}
        subtitle={t("transfers.outsideFidyDescription")}
      />
    </PickerDialog>
  );
}
