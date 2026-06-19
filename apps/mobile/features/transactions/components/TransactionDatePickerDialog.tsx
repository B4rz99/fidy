import { DatePickerDialog } from "@/shared/components";

export function TransactionDatePickerDialog(props: {
  readonly allowFuture?: boolean;
  readonly date: Date;
  readonly maximumDate?: Date;
  readonly minimumDate?: Date;
  readonly onChange: (date: Date) => void;
  readonly onClose: () => void;
  readonly visible: boolean;
}) {
  return <DatePickerDialog {...props} />;
}
