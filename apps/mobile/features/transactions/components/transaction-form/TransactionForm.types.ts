import type { FinancialAccountRow } from "@/features/financial-accounts/public";
import type { CategoryId, FinancialAccountId } from "@/shared/types/branded";
import type { TransactionType } from "../../schema";

export type DigitsInput = string | ((currentDigits: string) => string);

export type TransactionFormProps = {
  readonly accountId: FinancialAccountId | null;
  readonly accounts: readonly FinancialAccountRow[];
  readonly categoryId: CategoryId | null;
  readonly date: Date;
  readonly description: string;
  readonly digits: string;
  readonly extraActionLabel?: string;
  readonly isSaving: boolean;
  readonly onAccountChange: (id: FinancialAccountId) => void;
  readonly onCategoryChange: (id: CategoryId) => void;
  readonly onClose?: () => void;
  readonly onDelete?: () => void;
  readonly onDescriptionChange: (text: string) => void;
  readonly onDigitsChange: (digits: DigitsInput) => void;
  readonly onExtraAction?: () => void;
  readonly onSave: () => void;
  readonly onTypeChange: (type: TransactionType) => void;
  readonly saveLabel: string;
  readonly type: TransactionType;
};

export type TransactionFormModel = {
  readonly canSave: boolean;
  readonly cursorStyle: ReturnType<
    typeof import("@/shared/hooks").useBlinkingCursor
  >["cursorStyle"];
  readonly dateLabel: string;
  readonly descriptionFocused: boolean;
  readonly displayAmount: string;
  readonly handleDescriptionBlur: () => void;
  readonly handleDescriptionFocus: () => void;
  readonly handleKey: (key: string) => void;
};
