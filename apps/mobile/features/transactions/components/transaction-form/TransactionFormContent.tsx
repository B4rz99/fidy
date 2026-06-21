import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { useTransferEntry } from "@/features/transfers/ui.public";
import { MoneyAmountDisplay, MoneyEntryScreen, PinnedFormStack } from "@/shared/components";
import { EntryField, EntryTextInputField } from "@/shared/components/EntryScaffold";
import { Calendar, Pencil, Wallet } from "@/shared/components/icons";
import { View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { CategoryStrip } from "../CategoryStrip";
import { TransactionActionSection } from "./TransactionActionSection";
import { styles } from "./TransactionForm.styles";
import type {
  TransactionFormMode,
  TransactionFormModel,
  TransactionFormProps,
} from "./TransactionForm.types";
import { TransactionFormHeader } from "./TransactionFormHeader";

type TransactionFormContentProps = TransactionFormProps &
  TransactionFormModel & {
    readonly handleModeChange: (mode: TransactionFormMode) => void;
    readonly mode: TransactionFormMode;
    readonly onAccountPress: () => void;
    readonly onDatePress: () => void;
    readonly transferEntry: ReturnType<typeof useTransferEntry>;
  };

export function TransactionFormContent({
  accountId,
  accounts,
  canSave,
  categories,
  categoryId,
  cursorStyle,
  dateLabel,
  description,
  digits,
  extraActionLabel,
  handleKey,
  handleModeChange,
  isSaving,
  mode,
  onClose,
  onCategoryChange,
  onDelete,
  onAccountPress,
  onDatePress,
  onDescriptionChange,
  onExtraAction,
  onSave,
  saveLabel,
  transferEntry,
}: TransactionFormContentProps) {
  const { bottom: safeBottom, top: safeTop } = useSafeAreaInsets();
  const { t } = useTranslation();
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const isTransfer = mode === "transfer";
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const detailContent = (
    <PinnedFormStack>
      <EntryTextInputField
        icon={Pencil}
        label={t("transactions.descriptionExample")}
        value={description}
        onChangeText={onDescriptionChange}
      />
      <View style={{ flexDirection: "row", gap: 12, height: 50 }}>
        <EntryField
          icon={Wallet}
          label=""
          value={selectedAccount?.name ?? t("common.account")}
          onPress={onAccountPress}
        />
        <EntryField icon={Calendar} label={dateLabel} valueTone="primary" onPress={onDatePress} />
      </View>
      <CategoryStrip
        categories={categories}
        categoryId={categoryId}
        onCategoryChange={onCategoryChange}
      />
    </PinnedFormStack>
  );

  return (
    <>
      <MoneyEntryScreen
        amountContent={
          <View
            style={[
              styles.amountBanner,
              {
                backgroundColor: "transparent",
                borderColor: "transparent",
              },
            ]}
          >
            <MoneyAmountDisplay
              color={primaryColor}
              cursorStyle={cursorStyle}
              cursorVisible={false}
              digits={isTransfer ? transferEntry.digits : digits}
              size="hero"
            />
          </View>
        }
        amountStyle={styles.amountZone}
        contentStyle={[styles.headerZone, { paddingTop: safeTop + 12 }]}
        footerContent={
          <TransactionActionSection
            canSave={isTransfer ? !transferEntry.isConfirmDisabled : canSave}
            deleteLabel={t("transactions.deleteTransaction")}
            extraActionLabel={isTransfer ? undefined : extraActionLabel}
            handleKey={isTransfer ? transferEntry.onKeyPress : handleKey}
            isSaving={isTransfer ? false : isSaving}
            onDelete={isTransfer ? undefined : onDelete}
            onExtraAction={isTransfer ? undefined : onExtraAction}
            onSave={isTransfer ? transferEntry.onConfirm : onSave}
            safeBottom={safeBottom}
            saveLabel={saveLabel}
            topContent={isTransfer ? transferEntry.fields : detailContent}
          />
        }
        numpadVisible={false}
        onKeyPress={isTransfer ? transferEntry.onKeyPress : handleKey}
        topContent={
          <TransactionFormHeader
            closeLabel={t("common.close")}
            onClose={onClose}
            mode={mode}
            onModeChange={handleModeChange}
            secondaryColor={secondaryColor}
            transferLabel={t("transfers.activity.generic")}
          />
        }
      />
      {isTransfer ? transferEntry.overlays : null}
    </>
  );
}
