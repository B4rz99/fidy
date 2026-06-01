import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MoneyAmountDisplay, MoneyEntryScreen, PinnedFormStack } from "@/shared/components";
import { View } from "@/shared/components/rn";
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
  digits,
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
  const { bottom: safeBottom, top: safeTop } = useSafeAreaInsets();
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const accentRed = useThemeColor("accentRed");
  const borderSubtle = useThemeColor("borderSubtle");
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const amountColor = type === "expense" ? accentRed : accentGreen;
  const detailContent = (
    <PinnedFormStack>
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
        accountId={accountId}
        accounts={accounts}
        label={t("common.account")}
        onAccountChange={onAccountChange}
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
      />
    </PinnedFormStack>
  );

  return (
    <MoneyEntryScreen
      amountContent={
        <MoneyAmountDisplay
          color={amountColor}
          cursorStyle={cursorStyle}
          cursorVisible={!descriptionFocused}
          digits={digits}
          size="hero"
        />
      }
      amountStyle={styles.amountZone}
      contentStyle={[styles.headerZone, { paddingTop: safeTop + 12 }]}
      footerContent={
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
          topContent={detailContent}
        />
      }
      numpadVisible={false}
      onKeyPress={handleKey}
      topContent={
        <TransactionFormHeader
          closeLabel={t("common.close")}
          onClose={onClose}
          onTypeChange={onTypeChange}
          secondaryColor={secondaryColor}
          type={type}
        />
      }
    />
  );
}
