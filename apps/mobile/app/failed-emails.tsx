import { FlashList } from "@shopify/flash-list";
import { format } from "date-fns";
import { useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOptionalUserId } from "@/features/auth";
import {
  dismissFailedEmail,
  dismissFailedEmailSourceEvent,
  type ProcessedEmailRow,
  type ProcessedSourceEventRow,
  useEmailCaptureStore,
} from "@/features/email-capture";
import { ScreenLayout } from "@/shared/components";
import { Info, Plus, TriangleAlert } from "@/shared/components/icons";
import { Pressable, Text, View } from "@/shared/components/rn";
import { tryGetDb } from "@/shared/db";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";

const ItemSeparator = () => <View style={{ height: 10 }} />;

export default function FailedEmailsScreen() {
  const { back, push } = useRouter();
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const userId = useOptionalUserId();
  const db = userId ? tryGetDb(userId) : null;
  const failedEmails = useEmailCaptureStore((s) => s.failedEmails);
  const failedEmailSourceEvents = useEmailCaptureStore((s) => s.failedEmailSourceEvents);
  const failedItems = useMemo(
    () =>
      [
        ...failedEmails.map((email) => ({ kind: "legacy" as const, email })),
        ...failedEmailSourceEvents.map((email) => ({ kind: "source_event" as const, email })),
      ].sort((left, right) => right.email.receivedAt.localeCompare(left.email.receivedAt)),
    [failedEmailSourceEvents, failedEmails]
  );

  const handleAddManually = useCallback(() => {
    push("/add-transaction");
  }, [push]);

  const renderItem = useCallback(
    ({ item }: { item: (typeof failedItems)[number] }) => (
      <FailedEmailCard
        email={item.email}
        onDismiss={() => {
          if (!db || !userId) return;
          if (item.kind === "legacy") {
            void dismissFailedEmail(db, userId, item.email.id);
            return;
          }
          void dismissFailedEmailSourceEvent(db, userId, item.email.id);
        }}
        onAddManually={handleAddManually}
      />
    ),
    [db, handleAddManually, userId]
  );

  return (
    <ScreenLayout title={t("failedEmails.title")} variant="sub" onBack={() => back()}>
      <FlashList
        data={failedItems}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.kind}:${item.email.id}`}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingBottom: bottom + 40,
          paddingHorizontal: 16,
        }}
        ItemSeparatorComponent={ItemSeparator}
        ListHeaderComponent={
          <View style={{ paddingBottom: 10 }}>
            <Text className="font-poppins-medium text-label text-secondary dark:text-secondary-dark leading-relaxed">
              {t("failedEmails.subtitle")}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text className="font-poppins-medium text-label text-tertiary dark:text-tertiary-dark text-center pt-8">
            {t("failedEmails.empty")}
          </Text>
        }
      />
    </ScreenLayout>
  );
}

function FailedEmailCard({
  email,
  onDismiss,
  onAddManually,
}: {
  email: ProcessedEmailRow | ProcessedSourceEventRow;
  onDismiss: () => void;
  onAddManually: () => void;
}) {
  const { t, locale } = useTranslation();
  const redColor = useThemeColor("accentRed");
  const primaryColor = useThemeColor("primary");
  const borderColor = useThemeColor("borderSubtle");

  const dateStr = email.receivedAt
    ? format(new Date(email.receivedAt), "PP", { locale: getDateFnsLocale(locale) })
    : "";

  return (
    <View className="rounded-chart bg-card p-4 dark:bg-card-dark" style={{ gap: 12 }}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center" style={{ gap: 10 }}>
          <TriangleAlert size={18} color={redColor} />
          <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
            {getProviderLabel(email)}
          </Text>
        </View>
        <Text className="font-poppins-medium text-caption text-tertiary dark:text-tertiary-dark">
          {dateStr}
        </Text>
      </View>

      <Text
        className="font-poppins-medium text-label text-secondary dark:text-secondary-dark"
        numberOfLines={2}
      >
        {email.subject}
      </Text>

      {email.failureReason ? (
        <View
          className="flex-row items-center rounded-lg bg-accent-red-light px-2.5 dark:bg-accent-red-light-dark"
          style={{ gap: 6, paddingVertical: 4 }}
        >
          <Info size={14} color={redColor} />
          <Text className="font-poppins-medium text-[11px] text-accent-red dark:text-accent-red-dark">
            {formatReason(email.failureReason, t)}
          </Text>
        </View>
      ) : null}

      <View className="flex-row" style={{ gap: 10 }}>
        <Pressable
          onPress={onAddManually}
          className="flex-1 h-10 flex-row items-center justify-center rounded-[10px] bg-peach-btn dark:bg-peach-btn-dark"
          style={{ gap: 6 }}
        >
          <Plus size={16} color={primaryColor} />
          <Text className="font-poppins-semibold text-label text-primary dark:text-primary-dark">
            {t("failedEmails.addManually")}
          </Text>
        </Pressable>

        <Pressable
          onPress={onDismiss}
          className="flex-1 h-10 items-center justify-center rounded-[10px]"
          style={{ borderWidth: 1, borderColor }}
        >
          <Text className="font-poppins-medium text-label text-tertiary dark:text-tertiary-dark">
            {t("common.dismiss")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function formatReason(reason: string, t: (key: string) => string): string {
  if (reason === "parse_failed") return t("failedEmails.parseFailedReason");
  if (reason === "parse_error") return t("failedEmails.parseErrorReason");
  if (reason.startsWith("validation:")) return reason.replace("validation: ", "");
  return reason;
}

function getProviderLabel(email: ProcessedEmailRow | ProcessedSourceEventRow) {
  if ("provider" in email) return email.provider === "gmail" ? "Gmail" : "Outlook";
  return email.sourceId === "email_outlook" ? "Outlook" : "Gmail";
}
