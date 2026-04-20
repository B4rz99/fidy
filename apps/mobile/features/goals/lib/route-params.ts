type GoalDetailRouteParams = {
  readonly goalId?: string | readonly string[];
  readonly id?: string | readonly string[];
};

function getFirstNonEmptyRouteParam(value: string | readonly string[] | undefined): string | null {
  if (typeof value === "string") {
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  return value?.find((entry) => entry.trim().length > 0)?.trim() ?? null;
}

export function resolveGoalDetailGoalId(params: GoalDetailRouteParams): string | null {
  return getFirstNonEmptyRouteParam(params.goalId) ?? getFirstNonEmptyRouteParam(params.id);
}
