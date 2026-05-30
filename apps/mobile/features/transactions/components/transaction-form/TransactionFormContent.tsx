import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Keyboard, Pressable, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { CATEGORIES } from "../../lib/categories";
import { CategoryPill } from "../CategoryPill";
import { TransactionAccountSection } from "./TransactionAccountSection";
import { TransactionActionSection } from "./TransactionActionSection";
import { styles } from "./TransactionForm.styles";
import type { TransactionFormModel, TransactionFormProps } from "./TransactionForm.types";
import { TransactionFormHeader } from "./TransactionFormHeader";
import { TransactionMetadataRow } from "./TransactionMetadataRow";

type TransactionFormContentProps = TransactionFormProps & TransactionFormModel;

export function TransactionFormContent({
  accountId,
  accounts,
  canSave,
  categoryId,
  cursorStyle,
  dateLabel,
  description,
  descriptionFocused,
  displayAmount,
  extraActionLabel,
  handleDescriptionBlur,
  handleDescriptionFocus,
  handleKey,
  isSaving,
  onAccountChange,
  onCategoryChange,
  onClose,
  onDelete,
  onDescriptionChange,
  onExtraAction,
  onSave,
  onTypeChange,
  saveLabel,
  type,
}: TransactionFormContentProps) {
  const { bottom: safeBottom } = useSafeAreaInsets();
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");
  const accentRed = useThemeColor("accentRed");
  const borderSubtle = useThemeColor("borderSubtle");
  const cardColor = useThemeColor("card");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const tertiaryColor = useThemeColor("tertiary");
  const amountColor = type === "expense" ? accentRed : accentGreen;
  return (
    <Pressable
      style={[styles.container, { backgroundColor: cardColor }]}
      onPress={Keyboard.dismiss}
    >
      <View style={styles.headerZone}>
        <TransactionFormHeader
          amountColor={amountColor}
          closeLabel={t("common.close")}
          cursorStyle={cursorStyle}
          descriptionFocused={descriptionFocused}
          displayAmount={displayAmount}
          onClose={onClose}
          onTypeChange={onTypeChange}
          secondaryColor={secondaryColor}
          type={type}
        />

        <View style={styles.pillSection}>
          <View style={styles.pillGrid}>
            {CATEGORIES.map((category) => (
              <CategoryPill
                key={category.id}
                category={category}
                isSelected={categoryId === category.id}
                onPress={() => onCategoryChange(category.id)}
              />
            ))}
          </View>
        </View>

        <TransactionAccountSection
          accentGreen={accentGreen}
          accentGreenLight={accentGreenLight}
          accountId={accountId}
          accounts={accounts}
          borderSubtle={borderSubtle}
          cardColor={cardColor}
          label={t("common.account")}
          onAccountChange={onAccountChange}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
        />

        <TransactionMetadataRow
          borderSubtle={borderSubtle}
          dateLabel={dateLabel}
          description={description}
          descriptionPlaceholder={t("transactions.descriptionOptional")}
          onDescriptionBlur={handleDescriptionBlur}
          onDescriptionChange={onDescriptionChange}
          onDescriptionFocus={handleDescriptionFocus}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
          tertiaryColor={tertiaryColor}
        />
      </View>

      <TransactionActionSection
        canSave={canSave}
        deleteLabel={t("transactions.deleteTransaction")}
        extraActionLabel={extraActionLabel}
        handleKey={handleKey}
        isSaving={isSaving}
        onDelete={onDelete}
        onExtraAction={onExtraAction}
        onSave={onSave}
        safeBottom={safeBottom}
        saveLabel={saveLabel}
      />
    </Pressable>
  );
}
