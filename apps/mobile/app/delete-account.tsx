import { useRouter } from "expo-router";
import { useAuthStore } from "@/features/auth/hooks.public";
import { useDeleteAccountMutation } from "@/features/settings/hooks.public";
import {
  DialogActionButton,
  DialogActionStack,
  DialogRouteFrame,
  GlassSurface,
} from "@/shared/components";
import { TriangleAlert } from "@/shared/components/icons";
import { Alert, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

export default function DeleteAccountDialogRoute() {
  const { t } = useTranslation();
  const { back } = useRouter();
  const accessToken = useAuthStore((s) => s.session?.access_token);
  const deleteAccount = useDeleteAccountMutation();
  const accentRed = useThemeColor("accentRed");

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
      <View style={{ padding: 24, alignItems: "center", gap: 16 }}>
        <GlassSurface
          radius={32}
          padded={false}
          style={{
            width: 64,
            height: 64,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <TriangleAlert size={32} color={accentRed} />
        </GlassSurface>
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
        <DialogActionStack>
          <DialogActionButton
            label={t("common.cancel")}
            variant="secondary"
            onPress={() => back()}
          />
          <DialogActionButton
            label={t("settings.deleteAccountConfirm")}
            variant="danger"
            onPress={() => {
              void handleDelete();
            }}
            disabled={deleteAccount.isPending}
            loading={deleteAccount.isPending}
          />
        </DialogActionStack>
      </View>
    </DialogRouteFrame>
  );
}
