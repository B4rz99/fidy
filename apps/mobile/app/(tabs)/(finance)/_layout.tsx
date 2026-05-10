import { Stack } from "expo-router";
import { ProfileAvatarButton } from "@/features/settings/header.public";
import { useColorScheme } from "@/shared/components/rn";
import { Colors } from "@/shared/constants/theme";

export default function FinanceStackLayout() {
  const theme = Colors[useColorScheme() === "dark" ? "dark" : "light"];

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerLeft: () => <ProfileAvatarButton />,
        headerTitle: "",
        headerStyle: { backgroundColor: theme.page },
        headerTintColor: theme.primary,
      }}
    />
  );
}
