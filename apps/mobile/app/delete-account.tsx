import { useRouter } from "expo-router";
import { useAuthStore } from "@/features/auth/hooks.public";
import { useDeleteAccountMutation } from "@/features/settings/hooks.public";
import { DialogRouteFrame } from "@/shared/components";
import { TriangleAlert } from "@/shared/components/icons";
import { ActivityIndicator, Alert, Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

export default function DeleteAccountSheet() {
  const { t } = useTranslation();
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.session?.access_token);
  const deleteAccount = useDeleteAccountMutation();
  const accentRed = useThemeColor("accentRed");
  const borderColor = useThemeColor("borderSubtle");

  const handleDelete = async () => {
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
      await deleteAccount.mutateAsync({ supabaseUrl, token: accessToken ?? "" });
    } catch {
      Alert.alert(t("settings.deleteAccountTitle"), t("common.unknown"));
    }
  };

  return (
    <DialogRouteFrame>
      <View
        className="bg-card dark:bg-card-dark"
        style={{ padding: 24, alignItems: "center", gap: 16 }}
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
            onPress={() => {
              void handleDelete();
            }}
            disabled={deleteAccount.isPending}
            style={{
              height: 48,
              borderRadius: 16,
              backgroundColor: accentRed,
              alignItems: "center",
              justifyContent: "center",
              opacity: deleteAccount.isPending ? 0.6 : 1,
            }}
          >
            {deleteAccount.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-poppins-semibold" style={{ fontSize: 15, color: "#FFFFFF" }}>
                {t("settings.deleteAccountConfirm")}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </DialogRouteFrame>
  );
}
