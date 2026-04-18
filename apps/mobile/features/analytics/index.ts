// Types

// Components
export { AnalyticsScreen } from "./components/AnalyticsScreen";
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
export { subscribeAnalyticsToTransactions } from "./services/subscribe-analytics-to-transactions";
// Store
export {
  initializeAnalyticsSession,
  loadAnalyticsForUser,
  selectAnalyticsPeriod,
  useAnalyticsStore,
} from "./store";
