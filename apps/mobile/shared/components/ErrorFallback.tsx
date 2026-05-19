import { Image } from "expo-image";
import * as Updates from "expo-updates";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { Colors } from "@/shared/constants/theme";
import { useTranslation } from "@/shared/hooks/use-translation";

export function ErrorFallback() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Image
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- static asset require
        source={require("../../assets/images/icon.png")}
        style={styles.icon}
        contentFit="cover"
      />
      <Text style={styles.title}>{t("errorFallback.title")}</Text>
      <Text style={styles.body}>{t("errorFallback.body")}</Text>
      <Pressable
        onPress={() => {
          void Updates.reloadAsync().catch(() => undefined);
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
          {t("errorFallback.restart")}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: Colors.light.page,
  },
  icon: {
    width: 80,
    height: 80,
    marginBottom: 24,
    borderRadius: 16,
  },
  title: {
    fontSize: 22,
    fontFamily: "Poppins_700Bold",
    color: Colors.light.primary,
    marginBottom: 8,
    textAlign: "center",
  },
  body: {
    fontSize: 15,
    fontFamily: "Poppins_500Medium",
    color: Colors.light.secondary,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
});
