import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/features/auth";
import { getUnsyncedCount, useSettingsStore } from "@/features/settings";
import { TriangleAlert } from "@/shared/components/icons";
import { ActivityIndicator, Alert, Pressable, Text, View } from "@/shared/components/rn";
import { getDb } from "@/shared/db";
import { useThemeColor, useTranslation } from "@/shared/hooks";

export default function DeleteAccountSheet() {
  const { t } = useTranslation();
  const router = useRouter();
  const userId = useAuthStore((s) => s.session?.user?.id);
  const accessToken = useAuthStore((s) => s.session?.access_token);
  const isDeleting = useSettingsStore((s) => s.isDeleting);
  const deleteAccount = useSettingsStore((s) => s.deleteAccount);
  const accentRed = useThemeColor("accentRed");
  const borderColor = useThemeColor("borderSubtle");
  const [unsyncedCount, setUnsyncedCount] = useState(0);

  useEffect(() => {
    if (userId) {
      try {
        const db = getDb(userId);
        setUnsyncedCount(getUnsyncedCount(db));
      } catch {
        // DB may not be available
      }
    }
  }, [userId]);

  const handleDelete = async () => {
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
      await deleteAccount(supabaseUrl, accessToken ?? "");
    } catch {
      Alert.alert(t("settings.deleteAccountTitle"), t("common.unknown"));
    }
  };

  return (
    <View
      className="flex-1 bg-card dark:bg-card-dark"
      style={{ paddingHorizontal: 24, paddingTop: 24, alignItems: "center", gap: 16 }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: `${accentRed}1A`,
        }}
      >
        <TriangleAlert size={32} color={accentRed} />
      </View>
      <Text
        className="font-poppins-semibold text-primary dark:text-primary-dark"
        style={{ fontSize: 16 }}
      >
        {t("settings.deleteAccountTitle")}
      </Text>
      <Text
        className="font-poppins text-secondary dark:text-secondary-dark"
        style={{ fontSize: 13, lineHeight: 20, textAlign: "center" }}
      >
        {t("settings.deleteAccountWarning")}
      </Text>
      {unsyncedCount > 0 ? (
        <Text
          className="font-poppins-semibold"
          style={{ fontSize: 13, color: accentRed, textAlign: "center" }}
        >
          {t("settings.deleteAccountUnsyncedWarning", { count: unsyncedCount })}
        </Text>
      ) : null}
      <View style={{ width: "100%", gap: 12, marginTop: 8 }}>
        <Pressable
          onPress={() => router.back()}
          style={{
            height: 48,
            borderRadius: 16,
            borderWidth: 1,
            borderColor,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            className="font-poppins-semibold text-primary dark:text-primary-dark"
            style={{ fontSize: 15 }}
          >
            {t("common.cancel")}
          </Text>
        </Pressable>
        <Pressable
          onPress={handleDelete}
          disabled={isDeleting}
          style={{
            height: 48,
            borderRadius: 16,
            backgroundColor: accentRed,
            alignItems: "center",
            justifyContent: "center",
            opacity: isDeleting ? 0.6 : 1,
          }}
        >
          {isDeleting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="font-poppins-semibold" style={{ fontSize: 15, color: "#FFFFFF" }}>
              {t("settings.deleteAccountConfirm")}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
