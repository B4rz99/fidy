import { AmountFilter } from "../AmountFilter";

type SearchAmountPanelProps = {
  readonly handleMaxChange: (digits: string) => void;
  readonly handleMinChange: (digits: string) => void;
  readonly maxDigits: string;
  readonly minDigits: string;
};

export function SearchAmountPanel({
  handleMaxChange,
  handleMinChange,
  maxDigits,
  minDigits,
}: SearchAmountPanelProps) {
  return (
    <AmountFilter
      minDigits={minDigits}
      maxDigits={maxDigits}
      onChangeMin={handleMinChange}
      onChangeMax={handleMaxChange}
    />
  );
}
