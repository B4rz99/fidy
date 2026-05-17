export type RouteParamValue = string | string[] | undefined;

export function getFirstNonEmptyRouteParam(value: RouteParamValue): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  const trimmed = candidate?.trim();

  return trimmed === "" ? null : (trimmed ?? null);
}
