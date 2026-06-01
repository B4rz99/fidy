import {
  createEntryRouteOptions,
  createFullScreenRouteOptions,
  createScreenLayoutRouteOptions,
  createTransparentHeaderRouteOptions,
  dialogRouteOptions,
} from "@/shared/components";

type RootRouteTheme = Parameters<typeof createFullScreenRouteOptions>[0];

type Translate = (key: string) => string;

export const ROOT_STACK_ROUTES = {
  devOnlyTransparentHeader: ["design-system"],
  dialog: ["theme-picker", "language-picker", "delete-account", "enable-notifications"],
  entry: ["add-transaction", "add-transfer", "edit-transaction"],
  fullScreen: [
    "add-bill",
    "day-detail",
    "goal-detail",
    "create-goal",
    "add-payment",
    "edit-goal",
    "create-category",
  ],
  localQaTransparentHeader: ["qa-tools", "qa-open"],
  screenLayout: [
    "financial-account-identifier",
    "link-suggested-account",
    "reclassify-transaction",
  ],
  transparentHeader: [
    "analytics",
    "notifications",
    "search",
    "connected-accounts",
    "account-suggestions",
    "create-financial-account",
    "financial-accounts",
    "financial-account-details",
    "financial-account-form",
    "profile",
    "settings",
    "bills-calendar",
    "notification-preferences",
    "categories",
  ],
} as const;

export function createRootStackRouteOptions(theme: RootRouteTheme, t: Translate) {
  const fullScreen = createFullScreenRouteOptions(theme);

  return {
    dialog: dialogRouteOptions,
    entry: createEntryRouteOptions(),
    fullScreen,
    screenLayout: createScreenLayoutRouteOptions(theme),
    transparentHeader: createTransparentHeaderRouteOptions(theme),
    titled: {
      autoSuggestBudgets: {
        ...fullScreen,
        title: t("budgets.autoSuggest.title"),
      },
      createBudget: {
        ...fullScreen,
        title: t("budgets.create.title"),
      },
    },
  } as const;
}
