import { useCallback, useState } from "react";
import { SendHorizonal } from "@/shared/components/icons";
import { Pressable, TextInput, View } from "@/shared/components/rn";
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
  const borderSubtle = useThemeColor("borderSubtle");
  const tertiary = useThemeColor("tertiary");
  const accentGreen = useThemeColor("accentGreen");
  const supportTextColor = useAiSupportTextColor();

  const handleSend = useCallback(() => {
    const result = resolveChatComposerSend({ text, disabled });
    if (!result.canSend || !result.message) return;
    onSend(result.message);
    setText(result.nextText);
  }, [text, disabled, onSend]);

  const canSend = !disabled && text.trim().length > 0;

  return (
    <View
      className="flex-row items-end gap-2 bg-card dark:bg-card-dark"
      style={{
        marginHorizontal: 12,
        padding: 10,
        borderRadius: 24,
        borderWidth: 1,
        borderTopColor: borderSubtle,
        borderColor: borderSubtle,
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
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
