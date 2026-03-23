import PostHog from "posthog-react-native";

const posthog = new PostHog(process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? "", {
  host: "https://us.i.posthog.com",
});

export function identifyUser(userId: string): void {
  posthog.identify(userId);
}

export function resetAnalyticsUser(): void {
  posthog.reset();
}

export function trackTransactionCreated(props: {
  type: "expense" | "income";
  category: string;
  source: "manual" | "email" | "apple_pay" | "notification" | "ai_chat";
}): void {
  posthog.capture("transaction_created", props);
}

export function trackTransactionEdited(props: { category: string }): void {
  posthog.capture("transaction_edited", props);
}

export function trackTransactionDeleted(): void {
  posthog.capture("transaction_deleted");
}

export function trackBudgetCreated(props: { category: string }): void {
  posthog.capture("budget_created", props);
}

export function trackBudgetAlertViewed(props: { threshold: 80 | 100; category: string }): void {
  posthog.capture("budget_alert_viewed", props);
}

export function trackBudgetSuggestionAccepted(props: { count: number }): void {
  posthog.capture("budget_suggestion_accepted", props);
}

export function trackBudgetSuggestionRejected(): void {
  posthog.capture("budget_suggestion_rejected");
}

export function trackGoalCreated(): void {
  posthog.capture("goal_created");
}

export function trackGoalContributionAdded(): void {
  posthog.capture("goal_contribution_added");
}

export function trackGoalMilestoneReached(): void {
  posthog.capture("goal_milestone_reached");
}

export function trackBillCreated(props: {
  frequency: "monthly" | "biweekly" | "weekly" | "yearly";
}): void {
  posthog.capture("bill_created", props);
}

export function trackBillPaymentRecorded(): void {
  posthog.capture("bill_payment_recorded");
}

export function trackAiChatOpened(): void {
  posthog.capture("ai_chat_opened");
}

export function trackAiMessageSent(): void {
  posthog.capture("ai_message_sent");
}

export function trackAiMemoryViewed(): void {
  posthog.capture("ai_memory_viewed");
}

export function trackNotificationCenterOpened(): void {
  posthog.capture("notification_center_opened");
}

export function trackNotificationTapped(props: { type: string }): void {
  posthog.capture("notification_tapped", props);
}
