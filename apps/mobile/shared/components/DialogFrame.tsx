import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Modal, Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { GlassPressable } from "./GlassPressable";
import { GlassSurface } from "./GlassSurface";

type DialogFrameProps = {
  readonly children: ReactNode;
  readonly onClose: () => void;
  readonly testID?: string;
  readonly visible: boolean;
};

export function DialogFrame({ children, onClose, testID, visible }: DialogFrameProps) {
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

type DialogPanelProps = {
  readonly children: ReactNode;
  readonly maxHeight?: "72%" | "88%";
  readonly showHandle?: boolean;
  readonly style?: StyleProp<ViewStyle>;
};

export function DialogPanel({ children, maxHeight, showHandle = false, style }: DialogPanelProps) {
  const borderSubtle = useThemeColor("borderSubtle");
  const panelStyle = [
    {
      gap: 12,
      width: "100%" as const,
      maxWidth: 480,
      alignSelf: "center" as const,
      padding: 16,
      maxHeight,
    },
    style,
  ];
  const content = (
    <>
      {showHandle ? (
        <View
          style={{
            alignSelf: "center",
            width: 44,
            height: 4,
            borderRadius: 999,
            backgroundColor: borderSubtle,
          }}
        />
      ) : null}
      {children}
    </>
  );

  return (
    <GlassSurface
      padded={false}
      radius={24}
      style={panelStyle}
      onStartShouldSetResponder={() => true}
    >
      {content}
    </GlassSurface>
  );
}

export function DialogTitle({ children }: { readonly children: ReactNode }) {
  const primary = useThemeColor("primary");

  return (
    <Text style={{ color: primary, fontFamily: "Poppins_700Bold", fontSize: 22 }}>{children}</Text>
  );
}

export function DialogCancelButton({ onPress }: { readonly onPress: () => void }) {
  const { t } = useTranslation();
  const secondary = useThemeColor("secondary");
  const buttonStyle = {
    alignItems: "center" as const,
    paddingVertical: 14,
  };
  const label = (
    <Text style={{ color: secondary, fontFamily: "Poppins_600SemiBold", fontSize: 15 }}>
      {t("common.cancel")}
    </Text>
  );

  return (
    <GlassPressable onPress={onPress} radius={16} surfaceStyle={buttonStyle}>
      {label}
    </GlassPressable>
  );
}
