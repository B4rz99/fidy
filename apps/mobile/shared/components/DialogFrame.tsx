import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Modal, Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

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
  readonly backgroundRole?: "card" | "page";
  readonly children: ReactNode;
  readonly maxHeight?: "72%" | "88%";
  readonly showHandle?: boolean;
  readonly style?: StyleProp<ViewStyle>;
};

export function DialogPanel({
  backgroundRole = "page",
  children,
  maxHeight,
  showHandle = false,
  style,
}: DialogPanelProps) {
  const backgroundColor = useThemeColor(backgroundRole);
  const borderSubtle = useThemeColor("borderSubtle");

  return (
    <View
      style={[
        {
          gap: 12,
          width: "100%",
          maxWidth: 480,
          alignSelf: "center",
          borderRadius: 24,
          padding: 16,
          backgroundColor,
          maxHeight,
        },
        style,
      ]}
      onStartShouldSetResponder={() => true}
    >
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
    </View>
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
  const card = useThemeColor("card");
  const borderSubtle = useThemeColor("borderSubtle");

  return (
    <Pressable
      style={{
        alignItems: "center",
        borderRadius: 16,
        backgroundColor: card,
        borderWidth: 1,
        borderColor: borderSubtle,
        paddingVertical: 14,
      }}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={{ color: secondary, fontFamily: "Poppins_600SemiBold", fontSize: 15 }}>
        {t("common.cancel")}
      </Text>
    </Pressable>
  );
}
