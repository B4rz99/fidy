import { Sparkles } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useThemeColor } from "@/shared/hooks/use-theme-color";

const SUGGESTIONS = [
  "How much did I spend this month?",
  "What's my biggest expense?",
  "Compare my spending to last month",
  "Add a food expense for today",
] as const;

type StarterSuggestionsProps = {
  readonly onSelect: (text: string) => void;
};

export function StarterSuggestions({ onSelect }: StarterSuggestionsProps) {
  const accentGreenLight = useThemeColor("accentGreenLight");
  const accentGreen = useThemeColor("accentGreen");
  const borderSubtle = useThemeColor("borderSubtle");

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
        gap: 24,
      }}
    >
      <View style={{ alignItems: "center", gap: 8 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: accentGreenLight,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Sparkles size={24} color={accentGreen} />
        </View>
        <Text className="font-poppins-bold text-title text-primary dark:text-primary-dark">
          Fidy AI
        </Text>
        <Text className="font-poppins-medium text-body text-tertiary dark:text-tertiary-dark text-center">
          Ask me anything about your finances
        </Text>
      </View>
      <View style={{ width: "100%", gap: 10 }}>
        {SUGGESTIONS.map((suggestion) => (
          <Pressable
            key={suggestion}
            onPress={() => onSelect(suggestion)}
            className="bg-peach-light dark:bg-peach-light-dark"
            style={{
              borderRadius: 24,
              borderWidth: 1,
              borderColor: borderSubtle,
              paddingVertical: 12,
              paddingHorizontal: 20,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text className="font-poppins-medium text-label text-primary dark:text-primary-dark">
              {suggestion}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
