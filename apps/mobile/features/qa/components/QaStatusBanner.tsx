import { useAuthStore } from "@/features/auth/public";
import { Surface } from "@/shared/components";
import { StyleSheet, Text } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { useQaDevtoolsStore } from "../devtools-store";
import { isLocalQaAvailable } from "../local-session";

export function QaStatusBanner() {
  const { t } = useTranslation();
  const primary = useThemeColor("primary");
  const localQaSession = useAuthStore((state) => state.localQaSession);
  const flags = useQaDevtoolsStore((state) => state.flags);

  if (!isLocalQaAvailable() || !localQaSession || !flags.showQaBanner) {
    return null;
  }

  return (
    <Surface pointerEvents="none" radius={14} padded={false} style={styles.banner}>
      <Text style={{ fontFamily: "Poppins_600SemiBold", fontSize: 12, color: primary }}>
        {t("qaTools.banner", {
          profile: localQaSession.profile,
          offline: flags.simulateOffline
            ? t("qaTools.bannerOfflineOn")
            : t("qaTools.bannerOfflineOff"),
        })}
      </Text>
    </Surface>
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
