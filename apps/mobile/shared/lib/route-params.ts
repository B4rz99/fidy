export type RouteParamValue = string | readonly string[] | undefined;

export function getFirstNonEmptyRouteParam(value: RouteParamValue): string | null {
  const values: readonly (string | undefined)[] =
    typeof value === "string" || value === undefined ? [value] : value;
  const trimmed = values.map((entry) => entry?.trim() ?? "").find((entry) => entry.length > 0);

  return trimmed ?? null;
}
