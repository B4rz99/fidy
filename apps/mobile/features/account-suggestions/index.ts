import { createElement } from "react";

export {
  type AccountCreationSuggestion,
  createAccountSuggestionFingerprint,
  deriveAccountSuggestions,
} from "./lib/derive-account-suggestions";
export {
  type AccountSuggestionDismissalRow,
  getAccountSuggestionDismissalById,
  getAccountSuggestionDismissalsForUser,
  getActiveAccountSuggestionDismissal,
  saveAccountSuggestionDismissal,
  upsertAccountSuggestionDismissal,
} from "./lib/dismissals-repository";
export {
  findMatchingFinancialAccountId,
  matchFinancialAccountId,
} from "./lib/match-financial-account";
export {
  buildSuggestedFinancialAccountDraft,
  rankSuggestedFinancialAccounts,
} from "./lib/presentation";
export { createAccountSuggestionService } from "./services/create-account-suggestion-service";

type AccountSuggestionReviewScreenComponent =
  typeof import("./components/AccountSuggestionReviewScreen")["AccountSuggestionReviewScreen"];
type AccountSuggestionsPromptBannerComponent =
  typeof import("./components/AccountSuggestionsPromptBanner")["AccountSuggestionsPromptBanner"];
type OnboardingAccountReviewStepComponent =
  typeof import("./components/OnboardingAccountReviewStep")["OnboardingAccountReviewStep"];
type CreateSuggestedAccountScreenComponent =
  typeof import("./components/CreateSuggestedAccountScreen")["default"];
type LinkSuggestedAccountScreenComponent =
  typeof import("./components/LinkSuggestedAccountScreen")["default"];
type UseAccountSuggestionsHook =
  typeof import("./hooks/use-account-suggestions")["useAccountSuggestions"];

export const AccountSuggestionReviewScreen: AccountSuggestionReviewScreenComponent = (() => {
  const {
    AccountSuggestionReviewScreen: Component,
  } = require("./components/AccountSuggestionReviewScreen");
  return createElement(Component);
}) as AccountSuggestionReviewScreenComponent;

export const AccountSuggestionsPromptBanner: AccountSuggestionsPromptBannerComponent = ((props) => {
  const {
    AccountSuggestionsPromptBanner: Component,
  } = require("./components/AccountSuggestionsPromptBanner");
  return createElement(Component, props);
}) as AccountSuggestionsPromptBannerComponent;

export const OnboardingAccountReviewStep: OnboardingAccountReviewStepComponent = (() => {
  const {
    OnboardingAccountReviewStep: Component,
  } = require("./components/OnboardingAccountReviewStep");
  return createElement(Component);
}) as OnboardingAccountReviewStepComponent;

export const CreateSuggestedAccountScreen: CreateSuggestedAccountScreenComponent = (() => {
  const { default: Component } = require("./components/CreateSuggestedAccountScreen");
  return createElement(Component);
}) as CreateSuggestedAccountScreenComponent;

export const LinkSuggestedAccountScreen: LinkSuggestedAccountScreenComponent = (() => {
  const { default: Component } = require("./components/LinkSuggestedAccountScreen");
  return createElement(Component);
}) as LinkSuggestedAccountScreenComponent;

export const useAccountSuggestions: UseAccountSuggestionsHook = ((...args) => {
  const { useAccountSuggestions } = require("./hooks/use-account-suggestions");
  return useAccountSuggestions(...args);
}) as UseAccountSuggestionsHook;
