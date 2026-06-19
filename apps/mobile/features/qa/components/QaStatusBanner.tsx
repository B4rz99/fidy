import { useAuthStore } from "@/features/auth/public";
import { GlassSurface } from "@/shared/components";
import { StyleSheet, Text } from "@/shared/components/rn";
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
    <GlassSurface pointerEvents="none" radius={14} padded={false} style={styles.banner}>
      <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 12, color: "#161616" }}>
        {t("qaTools.banner", {
          profile: localQaSession.profile,
          offline: flags.simulateOffline
            ? t("qaTools.bannerOfflineOn")
            : t("qaTools.bannerOfflineOff"),
        })}
      </Text>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    right: 12,
    bottom: 18,
    left: 12,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
