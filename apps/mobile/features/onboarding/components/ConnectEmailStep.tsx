import type { ReactNode } from "react";
import { useOptionalUserId } from "@/features/auth/public";
import { GoogleIcon, MicrosoftIcon, OAuthButton } from "@/features/auth/ui.public";
import {
  connectEmailAccount,
  type EmailProvider,
  getGmailClientId,
  getOutlookClientId,
  useEmailCaptureStore,
} from "@/features/email-capture/public";
import { Button, Surface } from "@/shared/components";
import { CheckCircle, Mail, Shield } from "@/shared/components/icons";
import { StyleSheet, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useAsyncGuard, useThemeColor, useTranslation } from "@/shared/hooks";
import { getEmailConnectionChecklist, hasConnectedEmailAccount } from "../lib/email-connections";
import { logOnboardingEvent, trackOnboardingEvent } from "../lib/telemetry";
import { useOnboardingStore } from "../store";

const PROVIDER_COPY_KEYS = {
  gmail: {
    connected: "onboarding.connectEmail.gmailConnected",
    connect: "onboarding.connectEmail.connectGmail",
  },
  outlook: {
    connected: "onboarding.connectEmail.outlookConnected",
    connect: "onboarding.connectEmail.connectOutlook",
  },
} as const satisfies Record<
  EmailProvider,
  { readonly connected: string; readonly connect: string }
>;

const PROVIDER_ICONS = {
  gmail: <GoogleIcon />,
  outlook: <MicrosoftIcon />,
} as const satisfies Record<EmailProvider, ReactNode>;

export function ConnectEmailStep() {
  const { t } = useTranslation();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const nextStep = useOnboardingStore((s) => s.nextStep);
  const setEmailSkipped = useOnboardingStore((s) => s.setEmailSkipped);
  const accounts = useEmailCaptureStore((s) => s.accounts);
  const checklist = getEmailConnectionChecklist(accounts);
  const hasConnectedAccount = hasConnectedEmailAccount(accounts);

  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const accentGreen = useThemeColor("accentGreen");

  const { isBusy, run: guardedRun } = useAsyncGuard();

  const handleConnect = (provider: "gmail" | "outlook") =>
    guardedRun(async () => {
      if (!db || !userId) return;
      const beforeCount = useEmailCaptureStore.getState().accounts.length;
      logOnboardingEvent("email_connect_start", { provider, beforeCount });
      const clientId = provider === "gmail" ? getGmailClientId() : getOutlookClientId();
      const result = await connectEmailAccount(db, userId, provider, clientId);
      const latestAccounts = useEmailCaptureStore.getState().accounts;
      const connected = latestAccounts.length > beforeCount;
      trackOnboardingEvent("email_connect_result", {
        provider,
        connected,
        accountCount: latestAccounts.length,
        reason: result.connected ? "connected" : result.reason,
      });
    });

  const handleSkip = () => {
    setEmailSkipped(true);
    nextStep();
  };

  const handleContinue = () => {
    setEmailSkipped(false);
    nextStep();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Mail size={40} color={accentGreen} />
        </View>
        <Text style={[styles.title, { color: primaryColor }]}>
          {t("onboarding.connectEmail.title")}
        </Text>
        <Text style={[styles.description, { color: secondaryColor }]}>
          {t("onboarding.connectEmail.description")}
        </Text>

        <View style={styles.buttons}>
          {checklist.map((item) =>
            item.connected ? (
              <Surface
                key={item.provider}
                padded={false}
                radius={12}
                style={styles.connectedCard}
              >
                <View style={styles.providerRow}>
                  <View style={styles.providerIcon}>{PROVIDER_ICONS[item.provider]}</View>
                  <Text style={[styles.connectedText, { color: primaryColor }]}>
                    {t(PROVIDER_COPY_KEYS[item.provider].connected)}
                  </Text>
                </View>
                <CheckCircle size={22} color={accentGreen} />
              </Surface>
            ) : (
              <OAuthButton
                key={item.provider}
                icon={PROVIDER_ICONS[item.provider]}
                label={t(PROVIDER_COPY_KEYS[item.provider].connect)}
                onPress={() => {
                  void handleConnect(item.provider);
                }}
                textClassName="text-gray-800 dark:text-gray-200"
              />
            )
          )}
        </View>

        <Surface padded={false} radius={12} style={styles.trustBadge}>
          <Shield size={18} color={accentGreen} />
          <Text style={[styles.trustText, { color: secondaryColor }]}>
            {t("onboarding.connectEmail.trustBadge")}
          </Text>
        </Surface>
      </View>

      <Button
        label={
          hasConnectedAccount
            ? t("onboarding.connectEmail.syncConnectedEmails")
            : t("onboarding.connectEmail.skipForNow")
        }
        variant={hasConnectedAccount ? "primary" : "ghost"}
        onPress={hasConnectedAccount ? handleContinue : handleSkip}
        disabled={isBusy}
        style={hasConnectedAccount ? styles.continueButton : styles.skipButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 22,
    textAlign: "center",
  },
  description: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  buttons: {
    alignSelf: "stretch",
    gap: 12,
    marginTop: 8,
  },
  connectedCard: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  providerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  providerIcon: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  connectedText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
  },
  trustText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },
  skipButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  continueButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderCurve: "continuous",
  },
  skipText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
});
