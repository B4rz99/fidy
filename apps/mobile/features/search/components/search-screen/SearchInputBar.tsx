import { FieldSurface } from "@/shared/components";
import { Search } from "@/shared/components/icons";
import { StyleSheet, TextInput, View } from "@/shared/components/rn";
import type { SearchInputRef } from "./SearchScreen.types";

type SearchInputBarProps = {
  readonly handleTextChange: (text: string) => void;
  readonly inputRef: SearchInputRef;
  readonly inputText: string;
  readonly placeholder: string;
  readonly primary: string;
  readonly secondary: string;
};

export function SearchInputBar({
  handleTextChange,
  inputRef,
  inputText,
  placeholder,
  primary,
  secondary,
}: SearchInputBarProps) {
  return (
    <View className="px-4 pb-2 pt-1">
      <FieldSurface radius={12} contentStyle={styles.inputSurface} size="compact">
        <Search size={18} color={secondary} />
        <TextInput
          ref={inputRef}
          className="ml-2 flex-1 font-poppins-medium text-body"
          style={{ color: primary }}
          value={inputText}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor={secondary}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </FieldSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  inputSurface: {
    flexDirection: "row",
    alignItems: "center",
  },
});
