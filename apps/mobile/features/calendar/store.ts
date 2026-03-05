import { addMonths, subMonths } from "date-fns";
import { create } from "zustand";
import type { CategoryId } from "@/features/transactions/lib/categories";
import { generateId } from "@/shared/lib/generate-id";
import { MOCK_BILLS } from "./data/mock-bills";
import { type Bill, type BillFrequency, createBillSchema } from "./schema";

type PopupType = "none" | "addBill" | "billDetail";

type CalendarState = {
  currentMonth: Date;
  bills: Bill[];
  selectedBillId: string | null;
  popup: PopupType;
};

type CalendarActions = {
  nextMonth: () => void;
  prevMonth: () => void;
  openAddBill: () => void;
  openBillDetail: (id: string) => void;
  closePopup: () => void;
  addBill: (
    name: string,
    amount: string,
    frequency: BillFrequency,
    category: CategoryId
  ) => boolean;
};

export const useCalendarStore = create<CalendarState & CalendarActions>((set) => ({
  currentMonth: new Date(),
  bills: MOCK_BILLS,
  selectedBillId: null,
  popup: "none",

  nextMonth: () => set((s) => ({ currentMonth: addMonths(s.currentMonth, 1) })),
  prevMonth: () => set((s) => ({ currentMonth: subMonths(s.currentMonth, 1) })),

  openAddBill: () => set({ popup: "addBill" }),
  openBillDetail: (id) => set({ popup: "billDetail", selectedBillId: id }),
  closePopup: () => set({ popup: "none", selectedBillId: null }),

  addBill: (name, amount, frequency, category) => {
    const cents = Math.round(parseFloat(amount) * 100);
    if (Number.isNaN(cents)) return false;

    const result = createBillSchema.safeParse({
      name,
      amountCents: cents,
      frequency,
      categoryId: category,
      startDate: new Date(),
      isActive: true,
    });

    if (!result.success) return false;

    const newBill: Bill = {
      id: generateId("bill"),
      ...result.data,
    };

    set((s) => ({
      bills: [...s.bills, newBill],
      popup: "none",
      selectedBillId: null,
    }));
    return true;
  },
}));
