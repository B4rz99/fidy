import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { ArrowLeftRight, Calendar, Pencil, Tag } from "@/shared/components/icons";
import {
  PencilEntryField,
  PencilEntryScaffold,
  PencilEntryTextInputField,
  type PencilEntryTab,
} from "@/shared/components/PencilEntryScaffold";
import { Modal, Platform, Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { formatInputDisplay, MAX_AMOUNT_DIGITS } from "@/shared/lib";
import { useTransactionStore } from "@/features/transactions/store.public";
import type { TransferSide } from "../lib/build-transfer";
import { TransferSidePicker } from "./transfer-form/TransferSidePicker";
import { TRANSFER_FORM_TEST_IDS } from "./transfer-form/TransferForm.types";
import { useTransferForm } from "./transfer-form/useTransferForm";

function handlePencilTransferKey(currentDigits: string, key: string): string {
  if (key === "delete") return currentDigits.slice(0, -1);
  if (key === "000") return (currentDigits + key).slice(0, MAX_AMOUNT_DIGITS);
  if (/^[0-9]$/.test(key)) {
    return currentDigits.length < MAX_AMOUNT_DIGITS ? currentDigits + key : currentDigits;
  }
  return currentDigits;
}

function getSideTitle(
  side: TransferSide | null,
  accounts: ReturnType<typeof useTransferForm>["accounts"],
  t: ReturnType<typeof useTranslation>["t"]
) {
  if (side == null) return undefined;
  if (side.kind === "external") return t("transfers.outsideFidy");
  return accounts.find((account) => account.id === side.accountId)?.name ?? t("common.unknown");
}

export function PencilTransferEntryScreen(
  props: {
    readonly onTransactionTabSelect?: (tab: Exclude<PencilEntryTab, "transfer">) => void;
  } = {}
) {
  const { t } = useTranslation();
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const form = useTransferForm({});
  const setTransactionType = useTransactionStore((state) => state.setType);
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const card = useThemeColor("card");
  const page = useThemeColor("page");
  const borderSubtle = useThemeColor("borderSubtle");
  const accentGreen = useThemeColor("accentGreen");
  const modalBackdrop = useThemeColor("modalBackdrop");
  const onAccent = useThemeColor("onAccent");

  const handleTabPress = (tab: PencilEntryTab) => {
    if (tab === "transfer") return;
    setTransactionType(tab);
    props.onTransactionTabSelect?.(tab);
  };

  return (
    <>
      <PencilEntryScaffold
        activeTab="transfer"
        amount={formatInputDisplay(form.digits)}
        isConfirmDisabled={!form.canSave || form.isSaving}
        onConfirm={form.handleSave}
        onKeyPress={(key) => form.setDigits((digits) => handlePencilTransferKey(digits, key))}
        onTabPress={handleTabPress}
        tabs={[
          { key: "expense", label: t("transactions.expense") },
          { key: "income", label: t("transactions.income") },
          { key: "transfer", label: t("transfers.activity.generic") },
        ]}
        fields={
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
                value={getSideTitle(form.fromSide, form.accounts, t)}
                testID={TRANSFER_FORM_TEST_IDS.fromSide}
                onPress={() => form.setPickerTarget("from")}
              />
              <PencilEntryField
                icon={ArrowLeftRight}
                label={`${t("transfers.toLabel")}:`}
                value={getSideTitle(form.toSide, form.accounts, t)}
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
        }
      />

      <TransferSidePicker
        visible={form.pickerTarget != null}
        target={form.pickerTarget}
        currentSide={form.pickerTarget === "from" ? form.fromSide : form.toSide}
        accounts={form.accounts}
        balances={form.balances}
        onClose={form.handlePickerClose}
        onSelect={form.applySelectedSide}
      />

      <Modal visible={form.showDatePicker} transparent animationType="fade">
        <Pressable
          testID="calendar-picker.backdrop"
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: modalBackdrop }}
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

      <Modal visible={showCategoryPicker} transparent animationType="fade">
        <Pressable
          testID="category-picker.backdrop"
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: modalBackdrop }}
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
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: accentGreen,
                backgroundColor: card,
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
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
  );
}
