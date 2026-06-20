type RouteTheme = {
  readonly page: string;
  readonly primary: string;
};

export function createTransparentHeaderRouteOptions(theme: RouteTheme) {
  return {
    contentStyle: { backgroundColor: "transparent" },
    headerShadowVisible: false,
    headerShown: false,
    headerStyle: { backgroundColor: theme.page },
    headerTintColor: theme.primary,
  } as const;
}

export function createFullScreenRouteOptions(theme: RouteTheme) {
  return {
    contentStyle: { backgroundColor: "transparent" },
    headerShadowVisible: false,
    headerShown: false,
    headerStyle: { backgroundColor: theme.page },
    headerTintColor: theme.primary,
    presentation: "card",
  } as const;
}

export function createScreenLayoutRouteOptions(theme: RouteTheme) {
  return {
    ...createFullScreenRouteOptions(theme),
  } as const;
}

export function createEntryRouteOptions() {
  return {
    contentStyle: { backgroundColor: "transparent" },
    gestureEnabled: false,
    headerShown: false,
    presentation: "card",
    sheetGrabberVisible: false,
  } as const;
}

export const dialogRouteOptions = {
  animation: "fade",
  contentStyle: { backgroundColor: "transparent" },
  headerShown: false,
  presentation: "transparentModal",
} as const;
