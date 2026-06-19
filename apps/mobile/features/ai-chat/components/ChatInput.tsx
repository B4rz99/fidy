import { useState } from "react";
import { GlassPressable, Surface } from "@/shared/components";
import { SendHorizonal } from "@/shared/components/icons";
import { StyleSheet, TextInput, View } from "@/shared/components/rn";
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

  const handleSend = () => {
    const result = resolveChatComposerSend({ text, disabled });
    if (!result.canSend || !result.message) return;
    onSend(result.message);
    setText(result.nextText);
  };

  const canSend = !disabled && text.trim().length > 0;
  const sendIconColor = canSend ? accentGreen : "rgba(255, 255, 255, 0.72)";

  return (
    <Surface padded={false} radius={24} style={styles.composer}>
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
      <GlassPressable
        accessibilityLabel={t("common.send")}
        accessibilityRole="button"
        onPress={handleSend}
        disabled={!canSend}
        radius={20}
        padded={false}
        layoutStyle={styles.sendButton}
      >
        <SendHorizonal size={18} color={sendIconColor} />
      </GlassPressable>
    </Surface>
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
    height: 40,
    justifyContent: "center",
    width: 40,
  },
});
