import type { FinancialAccountRow } from "@/features/financial-accounts/public";
import type { Category } from "@/shared/categories";
import type { useBlinkingCursor } from "@/shared/hooks";
import type { CategoryId, FinancialAccountId } from "@/shared/types/branded";
import type { TransactionType } from "../../schema";

export type DigitsInput = string | ((currentDigits: string) => string);
export type TransactionFormMode = TransactionType | "transfer";

export type TransactionFormProps = {
  readonly accountId: FinancialAccountId | null;
  readonly accounts: readonly FinancialAccountRow[];
  readonly categories: readonly Category[];
  readonly categoryId: CategoryId | null;
  readonly date: Date;
  readonly description: string;
  readonly digits: string;
  readonly extraActionLabel?: string;
  readonly isSaving: boolean;
  readonly onAccountChange: (id: FinancialAccountId) => void;
  readonly onCategoryChange: (id: CategoryId) => void;
  readonly onClose?: () => void;
  readonly onDateChange: (date: Date) => void;
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
  readonly cursorStyle: ReturnType<typeof useBlinkingCursor>["cursorStyle"];
  readonly dateLabel: string;
  readonly descriptionFocused: boolean;
  readonly handleDescriptionBlur: () => void;
  readonly handleDescriptionFocus: () => void;
  readonly handleKey: (key: string) => void;
};
