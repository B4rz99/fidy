import { BellAction } from "@/features/notifications/ui.public";
import { SearchAction } from "@/features/search/ui.public";
import { Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type HomeScreenActionsProps = {
  readonly gap: number;
  readonly paddingHorizontal?: number;
};

export function HomeScreenActions({ gap, paddingHorizontal = 0 }: HomeScreenActionsProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap,
        paddingHorizontal,
      }}
    >
      <SearchAction />
      <BellAction />
    </View>
  );
}

export function HomeScreenHeaderTitle() {
  const primaryColor = useThemeColor("primary");

  return (
    <Text
      style={{
        fontFamily: "Poppins_800ExtraBold",
        fontSize: 20,
        color: primaryColor,
      }}
    >
      fidy
    </Text>
  );
}
