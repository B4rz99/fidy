import { FlashList } from "@shopify/flash-list";
import { format } from "date-fns";
import { useRouter } from "expo-router";
import { Info, Plus, TriangleAlert } from "lucide-react-native";
import { useCallback } from "react";
import { Pressable, Text, View } from "react-native";
import type { ProcessedEmailRow } from "@/features/email-capture/lib/repository";
import { ScreenLayout } from "@/shared/components/ScreenLayout";
import { useEmailCaptureStore } from "@/features/email-capture/store";
import { useThemeColor } from "@/shared/hooks/use-theme-color";

const ItemSeparator = () => <View style={{ height: 10 }} />;

export default function FailedEmailsScreen() {
  const { back, push } = useRouter();
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
    <ScreenLayout title="Unprocessed Emails" variant="sub" onBack={() => back()}>
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
              {
                "These bank emails couldn't be processed automatically. You can add them as transactions manually."
              }
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text className="font-poppins-medium text-label text-tertiary dark:text-tertiary-dark text-center pt-8">
            No unprocessed emails
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
  const redColor = useThemeColor("accentRed");
  const primaryColor = useThemeColor("primary");
  const borderColor = useThemeColor("borderSubtle");

  const dateStr = email.receivedAt ? format(new Date(email.receivedAt), "MMM d, yyyy") : "";

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
            {formatReason(email.failureReason)}
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
            Add manually
          </Text>
        </Pressable>

        <Pressable
          onPress={onDismiss}
          className="flex-1 h-10 items-center justify-center rounded-[10px]"
          style={{ borderWidth: 1, borderColor }}
        >
          <Text className="font-poppins-medium text-label text-tertiary dark:text-tertiary-dark">
            Dismiss
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function formatReason(reason: string): string {
  if (reason === "parse_failed") return "Could not extract transaction data";
  if (reason === "parse_error") return "Error while processing email";
  if (reason.startsWith("validation:")) return reason.replace("validation: ", "");
  return reason;
}
