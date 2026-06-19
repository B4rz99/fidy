import { Image } from "expo-image";
import * as Updates from "expo-updates";
import { StyleSheet, Text, View } from "@/shared/components/rn";
import { Colors } from "@/shared/constants/theme";
import { useTranslation } from "@/shared/hooks/use-translation";
import { GlassPressable } from "./GlassPressable";

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
      <GlassPressable
        onPress={() => {
          void Updates.reloadAsync().catch(() => undefined);
        }}
        android_ripple={{ color: "rgba(255, 255, 255, 0.28)", borderless: false }}
        padded={false}
        radius={12}
        style={styles.restartButton}
        surfaceLayoutStyle={styles.restartSurface}
      >
        <Text
          style={{
            fontSize: 16,
            fontFamily: "Poppins_600SemiBold",
            color: Colors.light.primary,
          }}
        >
          {t("errorFallback.restart")}
        </Text>
      </GlassPressable>
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
  restartButton: {
    alignSelf: "center",
  },
  restartSurface: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
});
