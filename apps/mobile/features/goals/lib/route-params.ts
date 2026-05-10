type GoalDetailRouteParams = {
  readonly goalId?: string | readonly string[];
  readonly id?: string | readonly string[];
};

function getFirstNonEmptyRouteParam(value: string | readonly string[] | undefined): string | null {
  if (value === undefined) return null;

  const values = Array.isArray(value) ? value : [value];
  const normalizedValues = values.map((entry) => entry.trim()).filter((entry) => entry.length > 0);

  return normalizedValues[0] ?? null;
}

export function resolveGoalDetailGoalId(params: GoalDetailRouteParams): string | null {
  return getFirstNonEmptyRouteParam(params.goalId) ?? getFirstNonEmptyRouteParam(params.id);
}
