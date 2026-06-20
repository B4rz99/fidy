import type { UserId } from "@/shared/types/branded";
import type { Bill, BillFrequency } from "../../schema";
import type { addBill, updateBill } from "../../store";

export type AddBillDraft = Parameters<typeof addBill>[0]["draft"];
export type UpdateBillInput = Omit<Parameters<typeof updateBill>[0], "db" | "userId">;

export type AddBillDraftState = {
  readonly amount: string;
  readonly category: AddBillDraft["categoryId"];
  readonly frequency: BillFrequency;
  readonly name: string;
  readonly startDate: Date;
};

export type AddBillMutations = {
  readonly canSubmit: boolean;
  readonly onAddBill: (draft: AddBillDraft) => Promise<boolean>;
  readonly onDone: () => void;
  readonly onUpdateBill: (input: UpdateBillInput) => Promise<boolean>;
};

export type AddBillFormProps = AddBillMutations & {
  readonly existingBill: Bill | undefined;
  readonly headerTitle: string;
};

export type AuthenticatedAddBillFormProps = {
  readonly existingBill: Bill | undefined;
  readonly headerTitle: string;
  readonly onDone: () => void;
  readonly userId: UserId;
};

export type AddBillDraftController = {
  readonly draft: AddBillDraftState;
  readonly isEdit: boolean;
  readonly setAmount: (amount: string) => void;
  readonly setCategory: (category: AddBillDraft["categoryId"]) => void;
  readonly setFrequency: (frequency: BillFrequency) => void;
  readonly setName: (name: string) => void;
  readonly setStartDate: (startDate: Date) => void;
};
