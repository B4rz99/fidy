import DateTimePicker from "@react-native-community/datetimepicker";
import { type ReactNode, useState } from "react";
import type { FinancialAccountRow } from "@/features/financial-accounts/public";
import { Wallet } from "@/shared/components/icons";
import { Modal, Platform, Pressable, ScrollView, Text, View } from "@/shared/components/rn";
import { useCurrentDate, useThemeColor, useTranslation } from "@/shared/hooks";
import { getCategoryLabel } from "@/shared/i18n";
import type { Category } from "../lib/categories";
import { CATEGORIES } from "../lib/categories";
import { sheetStyles } from "./PencilTransactionEntrySheets.styles";

type PickerSheetFrameProps = {
  readonly children: ReactNode;
  readonly onClose: () => void;
  readonly testID: string;
  readonly visible: boolean;
};

function PickerSheetFrame({ children, onClose, testID, visible }: PickerSheetFrameProps) {
  const modalBackdrop = useThemeColor("modalBackdrop");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        testID={testID}
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: `${modalBackdrop}40` }}
        onPress={onClose}
      >
        {children}
      </Pressable>
    </Modal>
  );
}

function SheetCancelButton({ onPress }: { readonly onPress: () => void }) {
  const { t } = useTranslation();
  const secondary = useThemeColor("secondary");
  const card = useThemeColor("card");
  const borderSubtle = useThemeColor("borderSubtle");

  return (
    <Pressable
      style={{
        alignItems: "center",
        borderRadius: 16,
        backgroundColor: card,
        borderWidth: 1,
        borderColor: borderSubtle,
        paddingVertical: 14,
      }}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={{ color: secondary, fontFamily: "Poppins_600SemiBold", fontSize: 15 }}>
        {t("common.cancel")}
      </Text>
    </Pressable>
  );
}

function SheetTitle({ children }: { readonly children: ReactNode }) {
  const primary = useThemeColor("primary");

  return (
    <Text style={{ color: primary, fontFamily: "Poppins_700Bold", fontSize: 22 }}>{children}</Text>
  );
}

function SheetBody(props: { readonly children: ReactNode; readonly maxHeight?: "72%" }) {
  const page = useThemeColor("page");

  return (
    <View
      style={{
        maxHeight: props.maxHeight,
        gap: 12,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        backgroundColor: page,
        padding: 16,
      }}
      onStartShouldSetResponder={() => true}
    >
      {props.children}
    </View>
  );
}

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

export function TransactionDatePickerSheet(props: {
  readonly date: Date;
  readonly onChange: (date: Date) => void;
  readonly onClose: () => void;
  readonly visible: boolean;
}) {
  const { t } = useTranslation();
  const card = useThemeColor("card");
  const accentGreen = useThemeColor("accentGreen");
  const onAccent = useThemeColor("onAccent");
  const maximumDate = useCurrentDate();

  return (
    <PickerSheetFrame
      visible={props.visible}
      testID="calendar-picker.backdrop"
      onClose={props.onClose}
    >
      <View
        style={{
          gap: 12,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          backgroundColor: card,
          padding: 16,
        }}
        onStartShouldSetResponder={() => true}
      >
        <SheetTitle>{t("common.date")}</SheetTitle>
        <DateTimePicker
          value={props.date}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          maximumDate={maximumDate}
          onChange={(_event, nextDate) => {
            if (Platform.OS !== "ios") props.onClose();
            if (nextDate) props.onChange(nextDate);
          }}
        />
        <Pressable
          style={{
            alignItems: "center",
            borderRadius: 16,
            backgroundColor: accentGreen,
            paddingVertical: 14,
          }}
          onPress={props.onClose}
          accessibilityRole="button"
        >
          <Text style={{ color: onAccent, fontFamily: "Poppins_600SemiBold", fontSize: 15 }}>
            {t("common.confirm")}
          </Text>
        </Pressable>
      </View>
    </PickerSheetFrame>
  );
}

export function TransactionCategoryPickerSheet(props: {
  readonly categoryId: Category["id"] | null;
  readonly locale: string;
  readonly onClose: () => void;
  readonly onSelect: (categoryId: Category["id"]) => void;
  readonly visible: boolean;
}) {
  const { t } = useTranslation();
  const primary = useThemeColor("primary");
  const card = useThemeColor("card");
  const borderSubtle = useThemeColor("borderSubtle");
  const accentGreen = useThemeColor("accentGreen");

  return (
    <PickerSheetFrame
      visible={props.visible}
      testID="category-picker.backdrop"
      onClose={props.onClose}
    >
      <SheetBody maxHeight="72%">
        <SheetTitle>{t("common.category")}</SheetTitle>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ gap: 8 }}>
            {CATEGORIES.map((category) => {
              const isSelected = category.id === props.categoryId;
              return (
                <Pressable
                  key={category.id}
                  style={[
                    sheetStyles.selectedRow,
                    {
                      borderColor: isSelected ? accentGreen : borderSubtle,
                      backgroundColor: card,
                    },
                  ]}
                  onPress={() => props.onSelect(category.id)}
                  accessibilityRole="button"
                >
                  <Text style={{ fontSize: 20 }}>{category.icon}</Text>
                  <Text
                    style={{
                      flex: 1,
                      color: primary,
                      fontFamily: "Poppins_600SemiBold",
                      fontSize: 15,
                    }}
                  >
                    {getCategoryLabel(category, props.locale)}
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
