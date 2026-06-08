import { HeaderHeightContext } from "@react-navigation/elements";
import { use } from "react";

export function useNativeHeaderHeight() {
  return use(HeaderHeightContext) ?? 0;
}
