// Pure derivation for weekly digest push notification content.
// No Deno-specific APIs — importable in both Deno (Edge Function) and Node (Vitest).

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WeeklyDigestData = {
  readonly totalSpent: number;
  readonly topCategories: readonly {
    readonly name: string;
    readonly amount: number;
  }[];
  readonly budgetStatus: "on_track" | "over" | "no_budgets";
  readonly goalContributionsThisWeek: number;
};

export type DigestMessage = {
  readonly title: string;
  readonly body: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a COP amount as "$1.234.567" (whole numbers, period separator — Colombian convention). */
const formatCop = (amount: number): string => `$${Math.round(amount).toLocaleString("es-CO")}`;

const buildCategorySegment = (
  categories: readonly { readonly name: string; readonly amount: number }[]
): string => {
  if (categories.length === 0) return "";
  if (categories.length === 1) return ` mostly on ${categories[0]?.name ?? ""}`;
  return ` mostly on ${categories[0]?.name ?? ""} and ${categories[1]?.name ?? ""}`;
};

const buildBudgetSegment = (status: WeeklyDigestData["budgetStatus"]): string => {
  if (status === "over") return ". You're over budget — consider adjusting for next week";
  if (status === "on_track") return ". You're on track with your budgets";
  return "";
};

const buildGoalSegment = (amount: number): string =>
  amount > 0 ? `. You saved ${formatCop(amount)} toward your goals` : "";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function deriveDigestMessage(data: WeeklyDigestData): DigestMessage {
  const spendingPart = `You spent ${formatCop(data.totalSpent)} this week`;
  const categoryPart = buildCategorySegment(data.topCategories);
  const budgetPart = buildBudgetSegment(data.budgetStatus);
  const goalPart = buildGoalSegment(data.goalContributionsThisWeek);

  const fullBody = `${spendingPart}${categoryPart}${budgetPart}${goalPart}`;

  // Truncate to 200 characters (push notification limit)
  const body = fullBody.length > 200 ? `${fullBody.slice(0, 197)}...` : fullBody;

  return { title: "Your Week in Review", body };
}
