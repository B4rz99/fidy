import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { ArrowLeftRight, Calendar, Pencil, Tag } from "@/shared/components/icons";
import {
  PencilEntryField,
  PencilEntryTextInputField,
} from "@/shared/components/PencilEntryScaffold";
import { Modal, Platform, Pressable, Text, View } from "@/shared/components/rn";
import { useCurrentDate, useThemeColor, useTranslation } from "@/shared/hooks";
import { formatInputDisplay, showSuccessToast } from "@/shared/lib";
import type { FinancialAccountRow } from "@/features/financial-accounts/public";
import { handleNumpadPress } from "@/features/transactions/display.public";
import type { TransferSide } from "../lib/build-transfer";
import { TransferSidePicker } from "./transfer-form/TransferSidePicker";
import { TRANSFER_FORM_TEST_IDS } from "./transfer-form/TransferForm.types";
import { useTransferForm } from "./transfer-form/useTransferForm";
import { transferEntryStyles } from "./PencilTransferEntryScreen.styles";

function getPencilTransferSideTitle(
  side: TransferSide | null,
  accounts: readonly FinancialAccountRow[],
  t: ReturnType<typeof useTranslation>["t"]
) {
  if (side == null) return undefined;
  if (side.kind === "external") return t("transfers.outsideFidy");
  return accounts.find((account) => account.id === side.accountId)?.name ?? t("common.unknown");
}

export function usePencilTransferEntry(props: { readonly enabled?: boolean } = {}) {
  const { t } = useTranslation();
  const form = useTransferForm({
    enabled: props.enabled ?? true,
    onSuccessfulSave: () => showSuccessToast(t("transfers.saved"), 1.6),
  });
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const maximumDate = useCurrentDate();
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const card = useThemeColor("card");
  const page = useThemeColor("page");
  const borderSubtle = useThemeColor("borderSubtle");
  const accentGreen = useThemeColor("accentGreen");
  const modalBackdrop = useThemeColor("modalBackdrop");
  const onAccent = useThemeColor("onAccent");

  return {
    amount: formatInputDisplay(form.digits),
    fields: (
      <>
        <PencilEntryTextInputField
          icon={Pencil}
          label={t("common.description")}
          value={form.description}
          onChangeText={form.setDescription}
        />
        <View style={{ flexDirection: "row", gap: 12, height: 50 }}>
          <PencilEntryField
            icon={ArrowLeftRight}
            label={`${t("transfers.fromLabel")}:`}
            value={getPencilTransferSideTitle(form.fromSide, form.accounts, t)}
            testID={TRANSFER_FORM_TEST_IDS.fromSide}
            onPress={() => form.setPickerTarget("from")}
          />
          <PencilEntryField
            icon={ArrowLeftRight}
            label={`${t("transfers.toLabel")}:`}
            value={getPencilTransferSideTitle(form.toSide, form.accounts, t)}
            testID={TRANSFER_FORM_TEST_IDS.toSide}
            onPress={() => form.setPickerTarget("to")}
          />
        </View>
        <View style={{ flexDirection: "row", gap: 12, height: 50 }}>
          <PencilEntryField
            icon={Calendar}
            label={form.dateLabel}
            valueTone="primary"
            testID={TRANSFER_FORM_TEST_IDS.date}
            onPress={() => form.setShowDatePicker(true)}
          />
          <PencilEntryField
            icon={Tag}
            label={`${t("common.category")}:`}
            value={t("transfers.activity.generic")}
            valueTone="tertiary"
            onPress={() => setShowCategoryPicker(true)}
          />
        </View>
      </>
    ),
    isConfirmDisabled: !form.canSave || form.isSaving,
    onConfirm: form.handleSave,
    onKeyPress: (key: string) => form.setDigits((digits) => handleNumpadPress(digits, key)),
    overlays: (
      <>
        <TransferSidePicker
          visible={form.pickerTarget != null}
          target={form.pickerTarget}
          currentSide={form.pickerTarget === "from" ? form.fromSide : form.toSide}
          accounts={form.accounts}
          balances={form.balances}
          onClose={form.handlePickerClose}
          onSelect={form.applySelectedSide}
        />
        <Modal
          visible={form.showDatePicker}
          transparent
          animationType="fade"
          onRequestClose={() => form.setShowDatePicker(false)}
        >
          <Pressable
            testID="calendar-picker.backdrop"
            style={{ flex: 1, justifyContent: "flex-end", backgroundColor: `${modalBackdrop}40` }}
            onPress={() => form.setShowDatePicker(false)}
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
              <Text style={{ color: primary, fontFamily: "Poppins_700Bold", fontSize: 22 }}>
                {t("common.date")}
              </Text>
              <DateTimePicker
                value={form.date}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                maximumDate={maximumDate}
                onChange={form.handleDateChange}
              />
              <Pressable
                style={{
                  alignItems: "center",
                  borderRadius: 16,
                  backgroundColor: accentGreen,
                  paddingVertical: 14,
                }}
                onPress={() => form.setShowDatePicker(false)}
                accessibilityRole="button"
              >
                <Text style={{ color: onAccent, fontFamily: "Poppins_600SemiBold", fontSize: 15 }}>
                  {t("common.confirm")}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
        <Modal
          visible={showCategoryPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCategoryPicker(false)}
        >
          <Pressable
            testID="category-picker.backdrop"
            style={{ flex: 1, justifyContent: "flex-end", backgroundColor: `${modalBackdrop}40` }}
            onPress={() => setShowCategoryPicker(false)}
          >
            <View
              style={{
                gap: 12,
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                backgroundColor: page,
                padding: 16,
              }}
              onStartShouldSetResponder={() => true}
            >
              <Text style={{ color: primary, fontFamily: "Poppins_700Bold", fontSize: 22 }}>
                {t("common.category")}
              </Text>
              <Pressable
                style={[
                  transferEntryStyles.categoryRow,
                  { borderColor: accentGreen, backgroundColor: card },
                ]}
                onPress={() => setShowCategoryPicker(false)}
                accessibilityRole="button"
              >
                <Tag size={20} color={secondary} />
                <Text
                  style={{
                    flex: 1,
                    color: primary,
                    fontFamily: "Poppins_600SemiBold",
                    fontSize: 15,
                  }}
                >
                  {t("transfers.activity.generic")}
                </Text>
                <Text style={{ color: accentGreen, fontFamily: "Poppins_700Bold" }}>✓</Text>
              </Pressable>
              <Pressable
                style={{
                  alignItems: "center",
                  borderRadius: 16,
                  backgroundColor: card,
                  borderWidth: 1,
                  borderColor: borderSubtle,
                  paddingVertical: 14,
                }}
                onPress={() => setShowCategoryPicker(false)}
                accessibilityRole="button"
              >
                <Text style={{ color: secondary, fontFamily: "Poppins_600SemiBold", fontSize: 15 }}>
                  {t("common.cancel")}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      </>
    ),
  };
}
