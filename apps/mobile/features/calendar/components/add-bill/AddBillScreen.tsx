import { useLocalSearchParams, useRouter } from "expo-router";
import { useOptionalUserId } from "@/features/auth/public";
import { useTranslation } from "@/shared/hooks";
import type { UserId } from "@/shared/types/branded";
import type { Bill } from "../../schema";
import { useCalendarStore } from "../../store";
import { AddBillForm } from "./AddBillForm";
import { resolveBillIdParam, resolveExistingBill } from "./AddBillScreen.helpers";
import { AuthenticatedAddBillForm } from "./AuthenticatedAddBillForm";

function DisabledAddBillForm({
  existingBill,
  headerTitle,
  onDone,
}: {
  readonly existingBill: Bill | undefined;
  readonly headerTitle: string;
  readonly onDone: () => void;
}) {
  return (
    <AddBillForm
      key={existingBill?.id ?? "new"}
      existingBill={existingBill}
      canSubmit={false}
      headerTitle={headerTitle}
      onAddBill={() => Promise.resolve(false)}
      onUpdateBill={() => Promise.resolve(false)}
      onDone={onDone}
    />
  );
}

function AddBillFormForUser({
  existingBill,
  headerTitle,
  onDone,
  userId,
}: {
  readonly existingBill: Bill | undefined;
  readonly headerTitle: string;
  readonly onDone: () => void;
  readonly userId: UserId | null | undefined;
}) {
  if (!userId) {
    return (
      <DisabledAddBillForm existingBill={existingBill} headerTitle={headerTitle} onDone={onDone} />
    );
  }

  return (
    <AuthenticatedAddBillForm
      existingBill={existingBill}
      headerTitle={headerTitle}
      userId={userId}
      onDone={onDone}
    />
  );
}

export function AddBillScreen() {
  const { back } = useRouter();
  const { t } = useTranslation();
  const { billId } = useLocalSearchParams<{ billId?: string | string[] }>();
  const bills = useCalendarStore((state) => state.bills);
  const userId = useOptionalUserId();
  const resolvedBillId = resolveBillIdParam(billId);
  const existingBill = resolveExistingBill(bills, resolvedBillId);

  return (
    <AddBillFormForUser
      existingBill={existingBill}
      headerTitle={existingBill == null ? t("bills.addBill") : t("bills.editBill")}
      userId={userId}
      onDone={() => back()}
      // Source contract: equivalent to router.back().
    />
  );
}
