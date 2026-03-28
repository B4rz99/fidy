import { ActivityIndicator } from "react-native";
import { Mic } from "@/shared/components/icons";
import { Modal, Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { useVoiceTransaction } from "../hooks/use-voice-transaction";
import { VoiceConfirmCard } from "./VoiceConfirmCard";

type VoiceBottomSheetProps = {
  readonly visible: boolean;
  readonly onClose: () => void;
};

export function VoiceBottomSheet({ visible, onClose }: VoiceBottomSheetProps) {
  const { t } = useTranslation();
  const { state, startListening, confirm, retry, cancel } = useVoiceTransaction();
  const accentGreen = useThemeColor("accentGreen");

  const handleClose = () => {
    cancel();
    onClose();
  };

  const handleConfirm = async () => {
    const saved = await confirm();
    if (saved) onClose();
  };

  const handleShow = () => {
    startListening();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      onShow={handleShow}
    >
      <Pressable className="flex-1 justify-end bg-black/50" onPress={handleClose}>
        <Pressable
          className="rounded-t-3xl bg-background px-6 pb-10 pt-6 dark:bg-background-dark"
          onPress={() => {}}
        >
          {/* Listening state */}
          {state.status === "listening" && (
            <View className="items-center gap-4 py-8">
              <View className="h-20 w-20 items-center justify-center rounded-full bg-accent-green/20 dark:bg-accent-green-dark/20">
                <Mic size={36} color={accentGreen} />
              </View>
              <Text className="text-lg font-medium text-primary dark:text-primary-dark">
                {t("voice.listening")}
              </Text>
              {state.transcript !== "" && (
                <Text className="text-center text-base text-secondary dark:text-secondary-dark">
                  {state.transcript}
                </Text>
              )}
            </View>
          )}

          {/* Parsing state */}
          {state.status === "parsing" && (
            <View className="items-center gap-4 py-8">
              <ActivityIndicator size="large" color={accentGreen} />
              <Text className="text-lg font-medium text-primary dark:text-primary-dark">
                {t("voice.understanding")}
              </Text>
              <Text className="text-center text-base text-secondary dark:text-secondary-dark">
                {state.transcript}
              </Text>
            </View>
          )}

          {/* Confirm state */}
          {state.status === "confirm" && (
            <VoiceConfirmCard
              parsed={state.parsed}
              onConfirm={handleConfirm}
              onCancel={handleClose}
            />
          )}

          {/* Saving state */}
          {state.status === "saving" && (
            <View className="items-center gap-4 py-8">
              <ActivityIndicator size="large" color={accentGreen} />
            </View>
          )}

          {/* Error state */}
          {state.status === "error" && (
            <View className="items-center gap-4 py-8">
              <Text className="text-center text-base text-primary dark:text-primary-dark">
                {t(`voice.${state.message}` as Parameters<typeof t>[0])}
              </Text>
              {state.transcript !== "" && (
                <Text className="text-center text-sm text-secondary dark:text-secondary-dark">
                  "{state.transcript}"
                </Text>
              )}
              <View className="flex-row gap-3">
                <Pressable
                  onPress={handleClose}
                  className="rounded-xl border border-border px-6 py-3 dark:border-border-dark"
                >
                  <Text className="font-medium text-secondary dark:text-secondary-dark">
                    {t("common.cancel")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={retry}
                  className="rounded-xl bg-accent-green px-6 py-3 dark:bg-accent-green-dark"
                >
                  <Text className="font-medium text-white">{t("voice.tryAgain")}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
