import type { ReactNode } from "react";
import { Modal, Pressable } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";

type PickerSheetFrameProps = {
  readonly children: ReactNode;
  readonly onClose: () => void;
  readonly testID: string;
  readonly visible: boolean;
};

export function PickerSheetFrame({ children, onClose, testID, visible }: PickerSheetFrameProps) {
  const modalBackdrop = useThemeColor("modalBackdrop");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        testID={testID}
        style={{
          flex: 1,
          justifyContent: "center",
          backgroundColor: `${modalBackdrop}40`,
          padding: 24,
        }}
        onPress={onClose}
      >
        {children}
      </Pressable>
    </Modal>
  );
}
