import { format } from "date-fns";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOptionalUserId } from "@/features/auth/public";
import {
  generateBackupRecoveryKey,
  type PrivateBackupHealthStatus,
} from "@/features/backup/public";
import { Card, FormTextField, ScreenLayout } from "@/shared/components";
import { CheckCircle, KeyRound, RefreshCcw, Shield, Smartphone } from "@/shared/components/icons";
import { Alert, Platform, ScrollView, Text, View } from "@/shared/components/rn";
import { useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";
import { captureError } from "@/shared/lib";
import { uploadConfirmedPrivateBackup } from "../lib/private-backup-upload";
import { useSettingsStore } from "../store";
import { BackupStatusCard } from "./BackupStatusCard";
import { BackupActionButton } from "./PrivateBackupActionButton";
import { PrivateBackupChecklist } from "./PrivateBackupChecklist";
import { StatusPill } from "./PrivateBackupStatusPill";

function getPrivateBackupStatusLabelKey(status: PrivateBackupHealthStatus) {
  switch (status) {
    case "not_set_up":
      return "privateBackup.status.notSetUp";
    case "recovery_key_not_confirmed":
      return "privateBackup.status.recoveryKeyNotConfirmed";
    case "ready":
      return "privateBackup.status.ready";
    case "backup_failed":
      return "privateBackup.status.backupFailed";
  }
}

const formatPrivateBackupCreatedAt = (createdAt: string, locale: string) =>
  format(new Date(createdAt), "PPp", { locale: getDateFnsLocale(locale) });

function AndroidSafeAreaSpacer({ bottom }: { readonly bottom: number }) {
  return Platform.OS === "ios" ? null : <View style={{ height: bottom }} />;
}

export function PrivateBackupScreen() {
  const { back } = useRouter();
  const userId = useOptionalUserId();
  const { t, locale } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const [confirmation, setConfirmation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const privateBackup = useSettingsStore((s) => s.privateBackup);
  const beginPrivateBackupSetup = useSettingsStore((s) => s.beginPrivateBackupSetup);
  const confirmPrivateBackupRecoveryKey = useSettingsStore(
    (s) => s.confirmPrivateBackupRecoveryKey
  );
  const markPrivateBackupUploadFailed = useSettingsStore((s) => s.markPrivateBackupUploadFailed);
  const markPrivateBackupUploadReady = useSettingsStore((s) => s.markPrivateBackupUploadReady);

  const startSetup = () => {
    beginPrivateBackupSetup(generateBackupRecoveryKey());
    setConfirmation("");
  };

  const uploadBackup = async (recoveryKey: string) => {
    if (userId === null) {
      Alert.alert(t("privateBackup.uploadFailedTitle"), t("privateBackup.signInRequired"));
      return null;
    }

    setIsSaving(true);
    try {
      return await uploadConfirmedPrivateBackup({
        userId,
        recoveryKey,
        confirmedRecoveryKey: recoveryKey,
      });
    } catch (error) {
      captureError(error);
      markPrivateBackupUploadFailed(new Date().toISOString());
      Alert.alert(t("privateBackup.uploadFailedTitle"), t("privateBackup.uploadFailedBody"));
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const confirmKey = async () => {
    if (confirmation.trim() !== privateBackup.generatedRecoveryKey) {
      Alert.alert(t("privateBackup.confirmMismatchTitle"), t("privateBackup.confirmMismatchBody"));
      return;
    }
    const confirmedRecoveryKey = confirmation.trim();
    const metadata = await uploadBackup(confirmedRecoveryKey);
    if (metadata === null) return;
    confirmPrivateBackupRecoveryKey(confirmedRecoveryKey, metadata);
    setConfirmation("");
  };

  const retryUpload = async () => {
    if (privateBackup.generatedRecoveryKey === null) return;
    const metadata = await uploadBackup(privateBackup.generatedRecoveryKey);
    if (metadata === null) return;
    markPrivateBackupUploadReady(metadata);
  };

  const viewKey = () => {
    Alert.alert(
      t("privateBackup.recoveryKeyLabel"),
      privateBackup.generatedRecoveryKey ?? t("privateBackup.keyUnavailable")
    );
  };

  const rotateKey = () => {
    beginPrivateBackupSetup(generateBackupRecoveryKey());
    setConfirmation("");
  };

  const health = privateBackup.health;
  const isConfirmingKey = health.status === "recovery_key_not_confirmed";
  const isReady = health.status === "ready";
  const isFailed = health.status === "backup_failed";
  const statusCopy = (() => {
    if (isReady) {
      return { title: t("privateBackup.readyTitle"), body: t("privateBackup.readyBody") };
    }

    if (isFailed) {
      return { title: t("privateBackup.failedTitle"), body: t("privateBackup.failedBody") };
    }

    if (isConfirmingKey) {
      return { title: t("privateBackup.confirmTitle"), body: t("privateBackup.confirmBody") };
    }

    return { title: t("privateBackup.notSetupTitle"), body: t("privateBackup.notSetupBody") };
  })();

  return (
    <ScreenLayout variant="sub" title={t("privateBackup.title")} onBack={back}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 40,
          gap: 12,
        }}
        contentInset={{ bottom }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <StatusPill
          label={t(getPrivateBackupStatusLabelKey(health.status))}
          tone={isReady ? "green" : "peach"}
        />

        <BackupStatusCard
          icon={isFailed ? RefreshCcw : Shield}
          title={statusCopy.title}
          body={statusCopy.body}
          tone={isFailed || isConfirmingKey ? "peach" : "green"}
        />

        {isConfirmingKey ? (
          <>
            <Card contentStyle={{ gap: 8 }}>
              <Text className="font-poppins-semibold text-xs text-secondary dark:text-secondary-dark">
                {t("privateBackup.recoveryKeyLabel").toUpperCase()}
              </Text>
              <Text
                className="font-poppins-bold text-primary dark:text-primary-dark"
                selectable
                style={{ fontSize: 16 }}
              >
                {privateBackup.generatedRecoveryKey}
              </Text>
              <Text className="font-poppins text-xs text-secondary dark:text-secondary-dark">
                {t("privateBackup.recoveryKeyHelper")}
              </Text>
            </Card>
            <FormTextField
              label={t("privateBackup.confirmPlaceholder")}
              value={confirmation}
              onChangeText={setConfirmation}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder={t("privateBackup.confirmPlaceholder")}
              labelStyle={{ display: "none" }}
              inputStyle={{
                minHeight: 52,
                borderRadius: 16,
                borderWidth: 1,
                paddingHorizontal: 16,
                fontFamily: "Poppins_400Regular",
                fontSize: 14,
              }}
            />
            <PrivateBackupChecklist />
            <BackupActionButton
              label={isSaving ? t("privateBackup.savingBackup") : t("privateBackup.saveKey")}
              onPress={confirmKey}
              disabled={isSaving}
            />
            <BackupActionButton
              label={t("privateBackup.finishLater")}
              onPress={back}
              variant="secondary"
            />
          </>
        ) : null}

        {isReady ? (
          <>
            <BackupStatusCard
              icon={CheckCircle}
              title={t("privateBackup.encryptedBackupTitle")}
              body={t("privateBackup.encryptedBackupBody", {
                backupDate: formatPrivateBackupCreatedAt(health.latestBackup.createdAt, locale),
              })}
            />
            <BackupStatusCard
              icon={KeyRound}
              title={t("privateBackup.recoveryKeySavedTitle")}
              body={t("privateBackup.recoveryKeySavedBody")}
            />
            <BackupStatusCard
              icon={Smartphone}
              title={t("privateBackup.newPhoneTitle")}
              body={t("privateBackup.newPhoneBody")}
            />
            <View className="flex-row" style={{ gap: 8 }}>
              <View className="flex-1">
                <BackupActionButton
                  label={t("privateBackup.viewKey")}
                  onPress={viewKey}
                  variant="secondary"
                />
              </View>
              <View className="flex-1">
                <BackupActionButton
                  label={t("privateBackup.rotateKey")}
                  onPress={rotateKey}
                  variant="secondary"
                />
              </View>
            </View>
          </>
        ) : null}

        {isFailed ? (
          <>
            <BackupActionButton
              label={isSaving ? t("privateBackup.savingBackup") : t("privateBackup.retryBackup")}
              onPress={retryUpload}
              disabled={isSaving}
            />
            <BackupActionButton
              label={t("privateBackup.rotateKey")}
              onPress={rotateKey}
              variant="secondary"
            />
          </>
        ) : null}

        {health.status === "not_set_up" ? (
          <BackupActionButton label={t("privateBackup.setUp")} onPress={startSetup} />
        ) : null}

        <Text className="font-poppins text-xs text-secondary dark:text-secondary-dark">
          {t("privateBackup.privacyNote")}
        </Text>
        <AndroidSafeAreaSpacer bottom={bottom} />
      </ScrollView>
    </ScreenLayout>
  );
}
