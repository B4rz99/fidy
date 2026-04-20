import { useAuthStore } from "@/features/auth";
import { Text, View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import { useQaDevtoolsStore } from "../devtools-store";
import { isLocalQaAvailable } from "../local-session";

export function QaStatusBanner() {
  const { t } = useTranslation();
  const localQaSession = useAuthStore((state) => state.localQaSession);
  const flags = useQaDevtoolsStore((state) => state.flags);

  if (!isLocalQaAvailable() || !localQaSession || !flags.showQaBanner) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        right: 12,
        bottom: 18,
        left: 12,
        borderRadius: 14,
        backgroundColor: "#161616DD",
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 12, color: "#FFFFFF" }}>
        {t("qaTools.banner", {
          profile: localQaSession.profile,
          offline: flags.simulateOffline
            ? t("qaTools.bannerOfflineOn")
            : t("qaTools.bannerOfflineOff"),
        })}
      </Text>
    </View>
  );
}
