import * as Notifications from "expo-notifications";
import type { BootstrapTask } from "@/shared/bootstrap/registry";
import type {
  AuthenticatedBootstrapContext,
  NotificationBootstrapContext,
} from "@/shared/bootstrap/types";
import { useSubscription } from "@/shared/hooks";
import { captureError } from "@/shared/lib";
import { initializeNotificationStore, registerPushToken } from "./public";
import { cleanupLegacyWeeklyDigestNotificationSchedules } from "./services/weekly-digest-schedule";

const notificationBehavior = {
  shouldShowBanner: true,
  shouldShowList: true,
  shouldPlaySound: false,
  shouldSetBadge: false,
} as const;

const registerCurrentPushToken = (userId: NotificationBootstrapContext["userId"]): void => {
  void registerPushToken(userId).catch(captureError);
};

const configureNotificationHandler = (): void => {
  Notifications.setNotificationHandler({
    handleNotification: async () => notificationBehavior,
  });
};

const subscribeNotificationNavigation = ({
  navigateToRoute,
}: Pick<NotificationBootstrapContext, "navigateToRoute">) =>
  Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    const route = data?.route;
    if (typeof route === "string" && route.startsWith("/")) {
      navigateToRoute(route);
    }
  });

export const notificationsBootstrapTask: BootstrapTask<AuthenticatedBootstrapContext> = {
  id: "notifications",
  run: ({ db, userId }) => {
    void initializeNotificationStore(db, userId).catch(captureError);
    void cleanupLegacyWeeklyDigestNotificationSchedules(userId).catch(captureError);
  },
};

export const useNotificationBootstrap = ({
  enableRemoteEffects,
  navigateToRoute,
  userId,
}: NotificationBootstrapContext): void => {
  useSubscription(() => {
    if (!enableRemoteEffects) return;

    configureNotificationHandler();
    registerCurrentPushToken(userId);
    const responseSub = subscribeNotificationNavigation({ navigateToRoute });

    return () => {
      responseSub.remove();
    };
  }, [enableRemoteEffects, navigateToRoute, userId]);
};
