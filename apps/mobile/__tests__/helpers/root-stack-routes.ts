import { expect } from "vitest";

export function expectRouteInRootStackGroup(source: string, groupName: string, routeName: string) {
  const groupMatch = new RegExp(`${groupName}:\\s*\\[([\\s\\S]*?)\\]`).exec(source);

  expect(groupMatch?.[1]).toContain(`"${routeName}"`);
}

export function expectTitledRouteExtendsFullScreen(source: string, routeKey: string) {
  const routeMatch = new RegExp(`${routeKey}:\\s*\\{([\\s\\S]*?)\\}`).exec(source);

  expect(routeMatch?.[1]).toContain("...fullScreen");
}
