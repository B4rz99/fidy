import { useRouter } from "expo-router";
import { ArrowLeftRight, type LucideIcon, Plus } from "@/shared/components/icons";
import { Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

function AddEntryCard({
  icon,
  title,
  body,
  badge,
  backgroundColor,
  borderColor,
  badgeBackground,
  iconBackground,
  iconColor,
  onPress,
  testID,
}: {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly body: string;
  readonly badge: string;
  readonly backgroundColor: string;
  readonly borderColor: string;
  readonly badgeBackground: string;
  readonly iconBackground: string;
  readonly iconColor: string;
  readonly onPress: () => void;
  // biome-ignore lint/style/useNamingConvention: React Native prop name
  readonly testID: string;
}) {
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const tertiary = useThemeColor("tertiary");
  const Icon = icon;

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={{
        borderRadius: 20,
        borderWidth: 1,
        borderColor,
        backgroundColor,
        padding: 16,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: iconBackground,
          }}
        >
          <Icon size={18} color={iconColor} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              fontFamily: "Poppins_700Bold",
              fontSize: 15,
              color: primary,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontFamily: "Poppins_500Medium",
              fontSize: 12,
              lineHeight: 16,
              color: secondary,
            }}
          >
            {body}
          </Text>
        </View>
        <Text
          style={{
            fontFamily: "Poppins_600SemiBold",
            fontSize: 18,
            color: tertiary,
          }}
        >
          ›
        </Text>
      </View>
      <View
        style={{
          alignSelf: "flex-start",
          borderRadius: 999,
          paddingHorizontal: 8,
          paddingVertical: 4,
          backgroundColor: badgeBackground,
        }}
      >
        <Text
          style={{
            fontFamily: "Poppins_600SemiBold",
            fontSize: 10,
            color: primary,
          }}
        >
          {badge}
        </Text>
      </View>
    </Pressable>
  );
}

export default function AddEntryChooserScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const card = useThemeColor("card");
  const borderSubtle = useThemeColor("borderSubtle");
  const peachLight = useThemeColor("peachLight");
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: peachLight,
        justifyContent: "center",
        paddingHorizontal: 16,
      }}
    >
      <View
        style={{
          borderRadius: 28,
          backgroundColor: card,
          paddingHorizontal: 16,
          paddingTop: 18,
          paddingBottom: 16,
          gap: 12,
        }}
      >
        <View
          style={{
            alignSelf: "center",
            width: 44,
            height: 4,
            borderRadius: 999,
            backgroundColor: borderSubtle,
          }}
        />

        <Text
          style={{
            fontFamily: "Poppins_700Bold",
            fontSize: 28,
            lineHeight: 32,
            color: primary,
          }}
        >
          {t("addEntry.title")}
        </Text>

        <Text
          style={{
            fontFamily: "Poppins_500Medium",
            fontSize: 13,
            lineHeight: 18,
            color: secondary,
          }}
        >
          {t("addEntry.subtitle")}
        </Text>

        <AddEntryCard
          icon={Plus}
          title={t("addEntry.transactionTitle")}
          body={t("addEntry.transactionBody")}
          badge={t("addEntry.transactionBadge")}
          backgroundColor={card}
          borderColor={borderSubtle}
          badgeBackground={peachLight}
          iconBackground="#F7EEE8"
          iconColor={primary}
          testID="add-chooser.transaction"
          onPress={() => router.push("/add-transaction" as never)}
        />

        <AddEntryCard
          icon={ArrowLeftRight}
          title={t("addEntry.transferTitle")}
          body={t("addEntry.transferBody")}
          badge={t("addEntry.transferBadge")}
          backgroundColor={accentGreenLight}
          borderColor={accentGreen}
          badgeBackground="#E8F4D0"
          iconBackground="#F4F8EA"
          iconColor={accentGreen}
          testID="add-chooser.transfer"
          onPress={() => router.push("/add-transfer" as never)}
        />

        <View
          style={{
            borderRadius: 18,
            backgroundColor: "#F8EFE8",
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Text
            style={{
              fontFamily: "Poppins_500Medium",
              fontSize: 12,
              lineHeight: 17,
              color: primary,
            }}
          >
            {t("addEntry.footnote")}
          </Text>
        </View>
      </View>
    </View>
  );
}
