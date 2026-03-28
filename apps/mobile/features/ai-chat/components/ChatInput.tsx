import { useCallback, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SendHorizonal } from "@/shared/components/icons";
import { Keyboard, Platform, Pressable, TextInput, View } from "@/shared/components/rn";
import { useSubscription, useThemeColor, useTranslation } from "@/shared/hooks";

type ChatInputProps = {
  readonly onSend: (text: string) => void;
  readonly disabled?: boolean;
};

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const { bottom: safeBottom } = useSafeAreaInsets();
  const borderSubtle = useThemeColor("borderSubtle");
  const tertiary = useThemeColor("tertiary");
  const accentGreen = useThemeColor("accentGreen");

  useSubscription(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  }, [text, disabled, onSend]);

  const canSend = !disabled && text.trim().length > 0;

  return (
    <View
      className="flex-row items-center gap-2 bg-card dark:bg-card-dark"
      style={{
        paddingTop: 8,
        paddingBottom: keyboardVisible ? 8 : Math.max(safeBottom, 8),
        paddingHorizontal: 16,
        borderTopWidth: 1,
        borderTopColor: borderSubtle,
      }}
    >
      <View
        className="flex-1 flex-row items-center bg-page dark:bg-page-dark"
        style={{ borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16 }}
      >
        <TextInput
          className="flex-1 text-primary dark:text-primary-dark"
          style={{ fontFamily: "poppins-medium", fontSize: 14, maxHeight: 100, padding: 0 }}
          placeholder={t("aiChat.placeholder")}
          placeholderTextColor={tertiary}
          value={text}
          onChangeText={setText}
          multiline
          editable={!disabled}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
      </View>
      <Pressable
        onPress={handleSend}
        disabled={!canSend}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: canSend ? accentGreen : tertiary,
          opacity: canSend ? 1 : 0.4,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <SendHorizonal size={18} color="#fff" />
      </Pressable>
    </View>
  );
}
