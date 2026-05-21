import { useLocalSearchParams } from "expo-router";
import { TransferFormScreen } from "@/features/transfers/routes.public";
import { DialogRouteFrame } from "@/shared/components";

export default function ReclassifyTransactionRoute() {
  const { nestedDialog } = useLocalSearchParams<{ nestedDialog?: string | string[] }>();
  const isNestedDialog = nestedDialog === "1";

  return (
    <DialogRouteFrame showBack={isNestedDialog} closeDepth={isNestedDialog ? 2 : 1}>
      <TransferFormScreen presentation="dialog" />
    </DialogRouteFrame>
  );
}
