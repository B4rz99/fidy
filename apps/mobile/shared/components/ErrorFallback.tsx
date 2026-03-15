import * as Updates from "expo-updates";
import { Image, Pressable, Text, View } from "react-native";
import { Colors } from "@/shared/constants/theme";

export function ErrorFallback() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 32,
        backgroundColor: Colors.light.page,
      }}
    >
      <Image
        source={require("../../assets/images/icon.png")}
        style={{ width: 80, height: 80, marginBottom: 24, borderRadius: 16 }}
      />
      <Text
        style={{
          fontSize: 22,
          fontFamily: "Poppins_700Bold",
          color: Colors.light.primary,
          marginBottom: 8,
          textAlign: "center",
        }}
      >
        Something went wrong
      </Text>
      <Text
        style={{
          fontSize: 15,
          fontFamily: "Poppins_500Medium",
          color: Colors.light.secondary,
          textAlign: "center",
          marginBottom: 32,
          lineHeight: 22,
        }}
      >
        {"Don't worry — your data is safe.\nPlease restart the app to continue."}
      </Text>
      <Pressable
        onPress={() => {
          Updates.reloadAsync().catch(() => {});
        }}
        style={({ pressed }) => ({
          backgroundColor: Colors.light.primary,
          paddingHorizontal: 32,
          paddingVertical: 14,
          borderRadius: 12,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text
          style={{
            fontSize: 16,
            fontFamily: "Poppins_600SemiBold",
            color: Colors.light.card,
          }}
        >
          Restart App
        </Text>
      </Pressable>
    </View>
  );
}
