import { FlashList } from "@shopify/flash-list";
import { format } from "date-fns";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { type ProcessedEmailRow, useEmailCaptureStore } from "@/features/email-capture";
import { ScreenLayout } from "@/shared/components";
import { Info, Plus, TriangleAlert } from "@/shared/components/icons";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { getDateFnsLocale } from "@/shared/i18n";

const ItemSeparator = () => <View style={{ height: 10 }} />;

export default function FailedEmailsScreen() {
  const { back, push } = useRouter();
  const { t } = useTranslation();
  const failedEmails = useEmailCaptureStore((s) => s.failedEmails);
  const dismissFailedEmail = useEmailCaptureStore((s) => s.dismissFailedEmail);

  const handleAddManually = useCallback(() => {
    push("/add-transaction");
  }, [push]);

  const renderItem = useCallback(
    ({ item }: { item: ProcessedEmailRow }) => (
      <FailedEmailCard
        email={item}
        onDismiss={() => dismissFailedEmail(item.id)}
        onAddManually={handleAddManually}
      />
    ),
    [dismissFailedEmail, handleAddManually]
  );

  return (
    <ScreenLayout title={t("failedEmails.title")} variant="sub" onBack={() => back()}>
      <FlashList
        data={failedEmails}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingBottom: 40,
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
  email: ProcessedEmailRow;
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
            {email.provider === "gmail" ? "Gmail" : "Outlook"}
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
