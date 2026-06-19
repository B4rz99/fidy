import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, DatePickerControl, Surface, MoneyAmountDisplay } from "@/shared/components";
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
import { useCurrentDate, useThemeColor, useTranslation } from "@/shared/hooks";
import { cleanDigitInput } from "@/shared/lib";
import { styles } from "./TransferForm.styles";
import { TRANSFER_FORM_TEST_IDS } from "./TransferForm.types";
import { TransferSideCard } from "./TransferSideCard";
import type { useTransferForm } from "./useTransferForm";

export function TransferFormContent(props: { readonly form: ReturnType<typeof useTransferForm> }) {
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const maximumDate = useCurrentDate();
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.container}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottom + 28 }]}
      >
        <Text style={[styles.subtitle, { color: secondary }]}>{props.form.subtitle}</Text>

        <Surface padded={false} radius={18} style={styles.amountCard}>
          <Text style={[styles.sectionEyebrow, { color: tertiary }]}>
            {t("transfers.amountLabel")}
          </Text>

          <View accessible={false} style={styles.amountDisplayWrap}>
            <MoneyAmountDisplay color={primary} digits={props.form.digits} size="hero" />
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
        </Surface>

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
          <Surface
            padded={false}
            radius={16}
            style={[
              styles.dateCard,
              props.form.isIos ? styles.dateCardIos : styles.dateCardAndroid,
            ]}
          >
            {props.form.isIos ? (
              <DatePickerControl
                testID={TRANSFER_FORM_TEST_IDS.date}
                value={props.form.date}
                display="compact"
                maximumDate={maximumDate}
                onSelect={props.form.handleDateSelect}
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
          </Surface>
        </View>

        <Surface padded={false} radius={16} style={styles.hintCard}>
          <TriangleAlert size={18} color={props.form.hintTone} />
          <Text style={[styles.hintText, { color: primary }]}>{props.form.hint}</Text>
        </Surface>

        <Button
          testID={TRANSFER_FORM_TEST_IDS.save}
          label={props.form.buttonLabel}
          onPress={props.form.canSave ? props.form.handleSave : undefined}
          disabled={!props.form.canSave || props.form.isSaving}
          loading={props.form.isSaving}
          accessible
          accessibilityRole="button"
          accessibilityLabel={props.form.buttonLabel}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
