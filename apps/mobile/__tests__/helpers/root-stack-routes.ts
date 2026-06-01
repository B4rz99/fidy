import { expect } from "vitest";

function escapeRegexLiteral(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function expectRouteInRootStackGroup(source: string, groupName: string, routeName: string) {
  const escapedGroupName = escapeRegexLiteral(groupName);
  const groupMatch = new RegExp(`${escapedGroupName}:\\s*\\[([\\s\\S]*?)\\]`).exec(source);

  expect(groupMatch?.[1]).toContain(`"${routeName}"`);
}

export function expectTitledRouteExtendsFullScreen(source: string, routeKey: string) {
  const escapedRouteKey = escapeRegexLiteral(routeKey);
  const routeMatch = new RegExp(`${escapedRouteKey}:\\s*\\{([\\s\\S]*?)\\}`).exec(source);

  expect(routeMatch?.[1]).toContain("...fullScreen");
}
