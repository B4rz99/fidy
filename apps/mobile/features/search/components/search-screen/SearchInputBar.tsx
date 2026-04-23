import { TextInput, View } from "@/shared/components/rn";
import type { SearchInputRef } from "./SearchScreen.types";

type SearchInputBarProps = {
  readonly handleTextChange: (text: string) => void;
  readonly inputRef: SearchInputRef;
  readonly inputText: string;
  readonly peachLight: string;
  readonly placeholder: string;
  readonly primary: string;
  readonly secondary: string;
};

export function SearchInputBar({
  handleTextChange,
  inputRef,
  inputText,
  peachLight,
  placeholder,
  primary,
  secondary,
}: SearchInputBarProps) {
  return (
    <View className="px-4 pb-2">
      <TextInput
        ref={inputRef}
        className="h-10 rounded-lg px-3 font-poppins-medium text-body"
        style={{ backgroundColor: peachLight, color: primary }}
        value={inputText}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        placeholderTextColor={secondary}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
    </View>
  );
}
