import { useCallback, useState } from "react";
import { GlassSurface } from "@/shared/components";
import { SendHorizonal } from "@/shared/components/icons";
import { Pressable, StyleSheet, TextInput, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { resolveChatComposerSend } from "../lib/chat-composer";
import { useAiSupportTextColor } from "./use-ai-support-text-color";

type ChatInputProps = {
  readonly onSend: (text: string) => void;
  readonly disabled?: boolean;
};

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const accentGreen = useThemeColor("accentGreen");
  const supportTextColor = useAiSupportTextColor();

  const handleSend = useCallback(() => {
    const result = resolveChatComposerSend({ text, disabled });
    if (!result.canSend || !result.message) return;
    onSend(result.message);
    setText(result.nextText);
  }, [text, disabled, onSend]);

  const canSend = !disabled && text.trim().length > 0;
  const sendButtonBackground = canSend ? accentGreen : "rgba(13, 13, 13, 0.72)";
  const sendButtonBorderColor = canSend ? "transparent" : "rgba(255, 255, 255, 0.24)";
  const sendIconColor = canSend ? "#fff" : "rgba(255, 255, 255, 0.72)";

  return (
    <GlassSurface nativeGlass={false} padded={false} radius={24} style={styles.composer}>
      <View style={styles.inputWrap}>
        <TextInput
          className="flex-1 text-primary dark:text-primary-dark"
          style={{ fontFamily: "poppins-medium", fontSize: 14, maxHeight: 100, padding: 0 }}
          placeholder={t("aiChat.placeholder")}
          placeholderTextColor={supportTextColor}
          value={text}
          onChangeText={setText}
          multiline
          editable={!disabled}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
      </View>
      <Pressable
        accessibilityLabel={t("common.send")}
        accessibilityRole="button"
        onPress={handleSend}
        disabled={!canSend}
        style={[
          styles.sendButton,
          {
            backgroundColor: sendButtonBackground,
            borderColor: sendButtonBorderColor,
          },
        ]}
      >
        <SendHorizonal size={18} color={sendIconColor} />
      </Pressable>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  composer: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 12,
    padding: 10,
  },
  inputWrap: {
    alignItems: "center",
    borderRadius: 20,
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendButton: {
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
});
