import { Platform } from "@/shared/components/rn";

type RouteTheme = {
  readonly page: string;
  readonly primary: string;
};

export function createTransparentHeaderRouteOptions(theme: RouteTheme) {
  return {
    contentStyle: { backgroundColor: "transparent" },
    headerShadowVisible: false,
    headerShown: Platform.OS === "ios",
    headerStyle: { backgroundColor: "transparent" },
    headerTransparent: true,
    headerTintColor: theme.primary,
  } as const;
}

export function createFullScreenRouteOptions(theme: RouteTheme) {
  return {
    contentStyle: { backgroundColor: "transparent" },
    headerShadowVisible: false,
    headerShown: true,
    headerStyle: { backgroundColor: Platform.OS === "ios" ? "transparent" : theme.page },
    headerTransparent: Platform.OS === "ios",
    headerTintColor: theme.primary,
    presentation: "card",
  } as const;
}

export function createScreenLayoutRouteOptions(theme: RouteTheme) {
  return {
    ...createFullScreenRouteOptions(theme),
    headerShown: Platform.OS === "ios",
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
