import { HeaderHeightContext } from "@react-navigation/elements";
import { useContext } from "react";

export function useNativeHeaderHeight() {
  return useContext(HeaderHeightContext) ?? 0;
}
