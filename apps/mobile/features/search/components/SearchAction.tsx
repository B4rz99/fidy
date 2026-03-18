import { useRouter } from "expo-router";
import { Search } from "@/shared/components/icons";
import { Pressable } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

export const SearchAction = () => {
  const { push } = useRouter();
  const iconColor = useThemeColor("primary");

  return (
    <Pressable onPress={() => push("/search" as never)} hitSlop={12}>
      <Search size={22} color={iconColor} />
    </Pressable>
  );
};
