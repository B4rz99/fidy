import type { FinancialAccountRow } from "@/features/financial-accounts/public";
import { Wallet } from "@/shared/components/icons";
import { Pressable, ScrollView, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { sheetStyles } from "./PencilTransactionEntrySheets.styles";
import { PickerSheetFrame } from "./PickerSheetFrame";
import { SheetBody } from "./SheetBody";
import { SheetCancelButton } from "./SheetCancelButton";
import { SheetTitle } from "./SheetTitle";

export function TransactionAccountPickerSheet(props: {
  readonly accountId: FinancialAccountRow["id"] | null;
  readonly accounts: readonly FinancialAccountRow[];
  readonly onClose: () => void;
  readonly onSelect: (accountId: FinancialAccountRow["id"]) => void;
  readonly visible: boolean;
}) {
  const { t } = useTranslation();
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const card = useThemeColor("card");
  const borderSubtle = useThemeColor("borderSubtle");
  const accentGreen = useThemeColor("accentGreen");

  return (
    <PickerSheetFrame
      visible={props.visible}
      testID="account-picker.backdrop"
      onClose={props.onClose}
    >
      <SheetBody maxHeight="72%">
        <SheetTitle>{t("common.account")}</SheetTitle>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ gap: 8 }}>
            {props.accounts.map((account) => {
              const isSelected = account.id === props.accountId;
              return (
                <Pressable
                  key={account.id}
                  style={[
                    sheetStyles.selectedRow,
                    {
                      borderColor: isSelected ? accentGreen : borderSubtle,
                      backgroundColor: card,
                    },
                  ]}
                  onPress={() => props.onSelect(account.id)}
                  accessibilityRole="button"
                >
                  <Wallet size={20} color={secondary} />
                  <Text
                    style={{
                      flex: 1,
                      color: primary,
                      fontFamily: "Poppins_600SemiBold",
                      fontSize: 15,
                    }}
                  >
                    {account.name}
                  </Text>
                  {isSelected ? (
                    <Text style={{ color: accentGreen, fontFamily: "Poppins_700Bold" }}>✓</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        <SheetCancelButton onPress={props.onClose} />
      </SheetBody>
    </PickerSheetFrame>
  );
}
