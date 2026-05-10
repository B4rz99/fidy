import { BellAction } from "@/features/notifications/ui.public";
import { SearchAction } from "@/features/search/ui.public";
import { View } from "@/shared/components/rn";

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
