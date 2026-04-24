import * as Notifications from "expo-notifications";
import type { BootstrapTask } from "@/shared/bootstrap/registry";
import type {
  AuthenticatedBootstrapContext,
  NotificationBootstrapContext,
} from "@/shared/bootstrap/types";
import { useSubscription } from "@/shared/hooks";
import { captureError } from "@/shared/lib";
import { initializeNotificationStore, registerPushToken } from "./public";

export const notificationsBootstrapTask: BootstrapTask<AuthenticatedBootstrapContext> = {
  id: "notifications",
  run: ({ db, userId }) => {
    void initializeNotificationStore(db, userId);
  },
};

export const useNotificationBootstrap = ({
  enableRemoteEffects,
  navigateToRoute,
  userId,
}: NotificationBootstrapContext): void => {
  useSubscription(() => {
    if (!enableRemoteEffects) return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    void registerPushToken(userId).catch(captureError);

    const tokenSub = Notifications.addPushTokenListener(() => {
      void registerPushToken(userId).catch(captureError);
    });

    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      const route = data?.route;
      if (typeof route === "string" && route.startsWith("/")) {
        navigateToRoute(route);
      }
    });

    return () => {
      tokenSub.remove();
      responseSub.remove();
    };
  }, [enableRemoteEffects, navigateToRoute, userId]);
};
