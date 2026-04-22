import DateTimePicker from "@react-native-community/datetimepicker";
import { TriangleAlert } from "@/shared/components/icons";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { cleanDigitInput, formatInputDisplay } from "@/shared/lib";
import { styles } from "./TransferForm.styles";
import { TRANSFER_FORM_TEST_IDS } from "./TransferForm.types";
import { TransferSideCard } from "./TransferSideCard";
import type { useTransferForm } from "./useTransferForm";

export function TransferFormContent(props: { readonly form: ReturnType<typeof useTransferForm> }) {
  const { t } = useTranslation();
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const card = useThemeColor("card");

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.subtitle, { color: secondary }]}>{props.form.subtitle}</Text>

        <View style={[styles.amountCard, { backgroundColor: card }]}>
          <Text style={[styles.sectionEyebrow, { color: tertiary }]}>
            {t("transfers.amountLabel")}
          </Text>

          <View accessible={false} style={styles.amountDisplayWrap}>
            <Text style={[styles.amountDisplay, { color: primary }]}>
              {formatInputDisplay(props.form.digits)}
            </Text>
            <TextInput
              testID={TRANSFER_FORM_TEST_IDS.amount}
              value={props.form.digits}
              onChangeText={(text) => props.form.setDigits(cleanDigitInput(text))}
              keyboardType="number-pad"
              autoCorrect={false}
              accessibilityLabel={t("transfers.a11y.amountField")}
              style={styles.amountInput}
            />
          </View>
        </View>

        <TransferSideCard
          label={t("transfers.fromLabel")}
          side={props.form.fromSide}
          accounts={props.form.accounts}
          balances={props.form.balances}
          isConflict={props.form.sameAccountConflict && props.form.lastEditedSide === "from"}
          testID={TRANSFER_FORM_TEST_IDS.fromSide}
          onPress={() => props.form.setPickerTarget("from")}
        />

        <TransferSideCard
          label={t("transfers.toLabel")}
          side={props.form.toSide}
          accounts={props.form.accounts}
          balances={props.form.balances}
          isConflict={props.form.sameAccountConflict && props.form.lastEditedSide === "to"}
          testID={TRANSFER_FORM_TEST_IDS.toSide}
          onPress={() => props.form.setPickerTarget("to")}
        />

        <View style={{ gap: 8 }}>
          <Text style={[styles.sectionLabel, { color: primary }]}>{t("transfers.dateLabel")}</Text>
          <View
            style={[
              styles.dateCard,
              props.form.isIos ? styles.dateCardIos : styles.dateCardAndroid,
              { backgroundColor: card },
            ]}
          >
            {props.form.isIos ? (
              <DateTimePicker
                testID={TRANSFER_FORM_TEST_IDS.date}
                value={props.form.date}
                mode="date"
                display="compact"
                onChange={props.form.handleDateChange}
              />
            ) : (
              <Pressable
                testID={TRANSFER_FORM_TEST_IDS.date}
                onPress={() => props.form.setShowDatePicker(true)}
                accessible
                accessibilityRole="button"
                accessibilityLabel={t("transfers.a11y.changeDate")}
                accessibilityValue={{ text: props.form.dateLabel }}
              >
                <Text style={[styles.dateValue, { color: primary }]}>{props.form.dateLabel}</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={[styles.hintCard, { backgroundColor: props.form.hintBackground }]}>
          <TriangleAlert size={18} color={props.form.hintTone} />
          <Text style={[styles.hintText, { color: primary }]}>{props.form.hint}</Text>
        </View>

        <Pressable
          testID={TRANSFER_FORM_TEST_IDS.save}
          onPress={props.form.canSave ? props.form.handleSave : undefined}
          disabled={!props.form.canSave || props.form.isSaving}
          accessible
          accessibilityRole="button"
          accessibilityLabel={props.form.buttonLabel}
          style={[
            styles.saveButton,
            {
              backgroundColor: props.form.buttonBackground,
              opacity: props.form.isSaving ? 0.6 : 1,
            },
          ]}
        >
          <Text style={styles.saveButtonText}>{props.form.buttonLabel}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
