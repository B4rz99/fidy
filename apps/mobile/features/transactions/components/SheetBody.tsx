import type { ReactNode } from "react";
import { View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import { sheetStyles } from "./PencilTransactionEntrySheets.styles";

export function SheetBody(props: { readonly children: ReactNode; readonly maxHeight?: "72%" }) {
  const page = useThemeColor("page");

  return (
    <View
      style={[sheetStyles.sheetBody, { maxHeight: props.maxHeight, backgroundColor: page }]}
      onStartShouldSetResponder={() => true}
    >
      {props.children}
    </View>
  );
}
