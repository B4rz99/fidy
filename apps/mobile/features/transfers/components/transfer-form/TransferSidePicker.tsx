import { readFinancialAccountKind } from "@/features/financial-accounts/lib/kind";
import type { FinancialAccountRow } from "@/features/financial-accounts/public";
import type { TransferSide } from "@/features/transfers/lib/build-transfer";
import { OUTSIDE_FIDY_LABEL } from "@/features/transfers/lib/build-transfer";
import { isTransferSideSelected } from "@/features/transfers/lib/presentation";
import { ChevronRight, ExternalLink } from "@/shared/components/icons";
import { Modal, Platform, Pressable, Text, View } from "@/shared/components/rn";
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
  const card = useThemeColor("card");
  const borderSubtle = useThemeColor("borderSubtle");
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");
  const accentRed = useThemeColor("accentRed");
  const modalBackdrop = useThemeColor("modalBackdrop");
  const peachLight = useThemeColor("peachLight");

  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
      <Pressable
        onPress={props.onClose}
        accessible={false}
        style={[styles.pickerBackdrop, { backgroundColor: `${modalBackdrop}40` }]}
      >
        <Pressable
          onPress={() => undefined}
          accessible={false}
          testID={TRANSFER_FORM_TEST_IDS.pickerSheet}
          style={[
            styles.pickerSheet,
            Platform.OS === "ios" ? styles.pickerSheetIos : styles.pickerSheetAndroid,
            { backgroundColor: card },
          ]}
        >
          <View style={[styles.pickerHandle, { backgroundColor: borderSubtle }]} />

          <View style={styles.pickerHeader}>
            <Text style={[styles.pickerTitle, { color: primary }]}>
              {t("transfers.pickerTitle")}
            </Text>
            <Text style={[styles.pickerSubtitle, { color: secondary }]}>
              {t("transfers.pickerSubtitle")}
            </Text>
          </View>

          <View style={{ gap: 10 }}>
            {props.accounts.map((account) => {
              const kind = readFinancialAccountKind(account.kind);
              const balance = props.balances[account.id] ?? 0;
              const isSelected = isTransferSideSelected(props.currentSide, account.id);
              const Icon = getKindIcon(account.kind);

              return (
                <Pressable
                  key={account.id}
                  testID={`${TRANSFER_FORM_TEST_IDS.pickerAccountPrefix}${account.id}`}
                  onPress={() =>
                    props.target &&
                    props.onSelect(props.target, { kind: "account", accountId: account.id })
                  }
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={account.name}
                  accessibilityHint={t(`financialAccounts.kinds.${kind}`)}
                  style={[
                    styles.sideCard,
                    {
                      borderColor: isSelected ? accentGreen : borderSubtle,
                      backgroundColor: isSelected ? accentGreenLight : card,
                    },
                  ]}
                >
                  <View style={[styles.sideIconWrap, { backgroundColor: peachLight }]}>
                    <Icon size={18} color={secondary} />
                  </View>

                  <View style={styles.sideTextWrap}>
                    <Text style={[styles.sideTitle, { color: primary }]}>{account.name}</Text>
                    <Text style={[styles.sideSubtitle, { color: secondary }]}>
                      {t(`financialAccounts.kinds.${kind}`)}
                    </Text>
                  </View>

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
                </Pressable>
              );
            })}

            <Pressable
              testID={TRANSFER_FORM_TEST_IDS.pickerOutsideFidy}
              onPress={() =>
                props.target &&
                props.onSelect(props.target, { kind: "external", label: OUTSIDE_FIDY_LABEL })
              }
              accessible
              accessibilityRole="button"
              accessibilityLabel={t("transfers.outsideFidy")}
              accessibilityHint={t("transfers.outsideFidyDescription")}
              style={[styles.sideCard, { backgroundColor: peachLight, borderColor: peachLight }]}
            >
              <View style={[styles.sideIconWrap, { backgroundColor: "#FFFFFFAA" }]}>
                <ExternalLink size={18} color={accentGreen} />
              </View>

              <View style={styles.sideTextWrap}>
                <Text style={[styles.sideTitle, { color: primary }]}>
                  {t("transfers.outsideFidy")}
                </Text>
                <Text style={[styles.sideSubtitle, { color: secondary }]}>
                  {t("transfers.outsideFidyDescription")}
                </Text>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
