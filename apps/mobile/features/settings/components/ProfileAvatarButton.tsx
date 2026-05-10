import { useState } from "react";
import { Image } from "expo-image";
import { type Href, useRouter } from "expo-router";
import { useAuthIdentity } from "@/features/auth/hooks.public";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { deriveProfileAvatar } from "../lib/profile-avatar";

type ProfileAvatarButtonProps = {
  readonly size?: number;
};

export function ProfileAvatarButton({ size = 36 }: ProfileAvatarButtonProps) {
  const { push } = useRouter();
  const { t } = useTranslation();
  const { fullName, email, profileImageUrl } = useAuthIdentity();
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const accentGreen = useThemeColor("accentGreen");
  const avatar = deriveProfileAvatar({
    fullName,
    email,
    profileImageUrl,
    didImageFail: profileImageUrl === failedImageUrl,
  });

  return (
    <Pressable
      accessibilityLabel={t("settings.openSettings")}
      accessibilityRole="button"
      onPress={() => push("/settings" as Href)}
      testID="settings.profile-avatar-button"
      className="items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: accentGreen, overflow: "hidden" }}
    >
      {avatar.type === "image" ? (
        <Image
          source={{ uri: avatar.uri }}
          style={{ width: size, height: size }}
          contentFit="cover"
          onError={() => setFailedImageUrl(avatar.uri)}
        />
      ) : (
        <View className="items-center justify-center" style={{ width: size, height: size }}>
          <Text className="font-poppins-semibold text-white" style={{ fontSize: size * 0.35 }}>
            {avatar.initials}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
