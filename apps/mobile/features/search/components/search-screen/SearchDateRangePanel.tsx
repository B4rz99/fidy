import { DateFilter } from "../DateFilter";

type SearchDateRangePanelProps = {
  readonly dateFrom: string | null;
  readonly dateTo: string | null;
  readonly handleDateRangeChange: (dateFrom: string | null, dateTo: string | null) => void;
};

export function SearchDateRangePanel({
  dateFrom,
  dateTo,
  handleDateRangeChange,
}: SearchDateRangePanelProps) {
  return <DateFilter dateFrom={dateFrom} dateTo={dateTo} onChangeRange={handleDateRangeChange} />;
}
