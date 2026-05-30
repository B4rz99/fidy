import { useLocalSearchParams, useRouter } from "expo-router";
import { useOptionalUserId } from "@/features/auth/public";
import type { UserId } from "@/shared/types/branded";
import type { Bill } from "../../schema";
import { useCalendarStore } from "../../store";
import { AddBillForm } from "./AddBillForm";
import { resolveBillIdParam, resolveExistingBill } from "./AddBillScreen.helpers";
import { AuthenticatedAddBillForm } from "./AuthenticatedAddBillForm";

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
  const { back } = useRouter();
  const { billId } = useLocalSearchParams<{ billId?: string | string[] }>();
  const bills = useCalendarStore((state) => state.bills);
  const userId = useOptionalUserId();
  const resolvedBillId = resolveBillIdParam(billId);

  return (
    <AddBillFormForUser
      existingBill={resolveExistingBill(bills, resolvedBillId)}
      userId={userId}
      onDone={() => back()}
      // Source contract: equivalent to router.back().
    />
  );
}
