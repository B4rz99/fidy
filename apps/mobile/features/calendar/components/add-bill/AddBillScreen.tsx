import { useLocalSearchParams, useRouter } from "expo-router";
import { useOptionalUserId } from "@/features/auth";
import type { UserId } from "@/shared/types/branded";
import type { Bill } from "../../schema";
import { useCalendarStore } from "../../store";
import { AddBillForm } from "./AddBillForm";
import { AuthenticatedAddBillForm } from "./AuthenticatedAddBillForm";

function resolveExistingBill(bills: readonly Bill[], billId: string | undefined) {
  return billId ? bills.find((bill) => bill.id === billId) : undefined;
}

function DisabledAddBillForm({
  existingBill,
  onDone,
}: {
  readonly existingBill: Bill | undefined;
  readonly onDone: () => void;
}) {
  return (
    <AddBillForm
      key={existingBill?.id ?? "new"}
      existingBill={existingBill}
      canSubmit={false}
      onAddBill={() => Promise.resolve(false)}
      onUpdateBill={() => Promise.resolve(false)}
      onDone={onDone}
    />
  );
}

function AddBillFormForUser({
  existingBill,
  onDone,
  userId,
}: {
  readonly existingBill: Bill | undefined;
  readonly onDone: () => void;
  readonly userId: UserId | null | undefined;
}) {
  if (!userId) return <DisabledAddBillForm existingBill={existingBill} onDone={onDone} />;

  return <AuthenticatedAddBillForm existingBill={existingBill} userId={userId} onDone={onDone} />;
}

export function AddBillScreen() {
  const router = useRouter();
  const { billId } = useLocalSearchParams<{ billId?: string }>();
  const bills = useCalendarStore((state) => state.bills);
  const userId = useOptionalUserId();

  return (
    <AddBillFormForUser
      existingBill={resolveExistingBill(bills, billId)}
      userId={userId}
      onDone={() => router.back()}
    />
  );
}
