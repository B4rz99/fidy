import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import migrations from "@/drizzle/migrations";
import { getDb } from "@/shared/db";
import { addBill, updateBill } from "../../store";
import { AddBillForm } from "./AddBillForm";
import type { AuthenticatedAddBillFormProps } from "./AddBillForm.types";

export function AuthenticatedAddBillForm({
  existingBill,
  onDone,
  userId,
}: AuthenticatedAddBillFormProps) {
  const db = getDb(userId);
  const { success: migrationsReady } = useMigrations(db, migrations);

  return (
    <AddBillForm
      key={existingBill?.id ?? "new"}
      existingBill={existingBill}
      canSubmit={migrationsReady}
      onAddBill={(draft) => {
        if (!migrationsReady) return Promise.resolve(false);
        return addBill({ db, userId, draft });
      }}
      onUpdateBill={(input) => {
        if (!migrationsReady) return Promise.resolve(false);
        return updateBill({ db, userId, ...input });
      }}
      onDone={onDone}
    />
  );
}
