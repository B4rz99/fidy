type GoalDetailRouteParams = {
  readonly goalId?: string | readonly string[];
  readonly id?: string | readonly string[];
};

function getFirstNonEmptyRouteParam(value: string | readonly string[] | undefined): string | null {
  if (value === undefined) return null;

  const values = Array.isArray(value) ? value : [value];
  const normalizedValues = values.flatMap((entry) => {
    const trimmed = entry.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  });

  return normalizedValues[0] ?? null;
}

export function resolveGoalDetailGoalId(params: GoalDetailRouteParams): string | null {
  return getFirstNonEmptyRouteParam(params.goalId) ?? getFirstNonEmptyRouteParam(params.id);
}
