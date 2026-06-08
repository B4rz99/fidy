import { useHeaderHeight } from "@react-navigation/elements";

export function useNativeHeaderHeight() {
  return useHeaderHeight() ?? 0;
}
