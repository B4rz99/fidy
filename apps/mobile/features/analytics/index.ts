// Types
export type {
  AnalyticsPeriod,
  CategoryBreakdownItem,
  IncomeExpenseResult,
  PeriodDelta,
  PeriodRange,
} from "./lib/derive";

// Pure derivations
export {
  computePeriodRange,
  deriveCategoryBreakdown,
  deriveIncomeExpense,
  derivePeriodDelta,
} from "./lib/derive";

// Repository
export {
  getIncomeExpenseForPeriod,
  getSpendingByCategoryForPeriod,
} from "./lib/repository";

// Store
export { useAnalyticsStore } from "./store";

// Components
export { AnalyticsScreen } from "./components/AnalyticsScreen";
