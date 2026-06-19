import { Stack, useRouter } from "expo-router";
import type { ReactNode } from "react";
import {
  Button,
  Card,
  GlassSurface,
  ProgressBar,
  ScreenLayout,
  SettingsSection,
} from "@/shared/components";
import { Bell, CheckCircle, Sparkles, Wallet } from "@/shared/components/icons";
import { Pressable, ScrollView, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";

export function DesignSystemScreen() {
  const { back } = useRouter();
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const onAccent = useThemeColor("onAccent");
  const secondary = useThemeColor("secondary");

  return (
    <ScreenLayout variant="sub" title={t("designSystem.title")} onBack={back}>
      <Stack.Screen options={{ title: t("designSystem.title") }} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 48 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 6 }}>
          <Text className="font-poppins-bold text-title text-primary dark:text-primary-dark">
            {t("designSystem.heading")}
          </Text>
          <Text className="font-poppins text-body text-secondary dark:text-secondary-dark">
            {t("designSystem.subtitle")}
          </Text>
        </View>

        <SettingsSection label={t("designSystem.typographySection")}>
          <View className="p-4" style={{ gap: 10 }}>
            <Text className="font-poppins-extrabold text-balance text-primary dark:text-primary-dark">
              $2.450.000
            </Text>
            <Text className="font-poppins-bold text-title text-primary dark:text-primary-dark">
              {t("designSystem.titleSample")}
            </Text>
            <Text className="font-poppins-medium text-body text-secondary dark:text-secondary-dark">
              {t("designSystem.bodySample")}
            </Text>
            <Text className="font-poppins-semibold text-caption text-tertiary dark:text-tertiary-dark">
              {t("designSystem.captionSample")}
            </Text>
          </View>
        </SettingsSection>

        <SettingsSection label={t("designSystem.colorsSection")}>
          <View className="p-4" style={{ gap: 12 }}>
            <View className="flex-row" style={{ gap: 12 }}>
              <ColorSwatch label="accent" className="bg-accent-green dark:bg-accent-green-dark" />
              <GlassSwatch label="glass" />
              <ColorSwatch label="peach" className="bg-peach-light dark:bg-peach-light-dark" />
            </View>
            <View className="flex-row" style={{ gap: 12 }}>
              <ColorSwatch label="red" className="bg-accent-red dark:bg-accent-red-dark" />
              <ColorSwatch label="chart" className="bg-chart-food" />
              <ColorSwatch label="nav" className="bg-nav dark:bg-nav-dark" />
            </View>
          </View>
        </SettingsSection>

        <SettingsSection label={t("designSystem.buttonsSection")}>
          <View className="p-4" style={{ gap: 12 }}>
            <Button
              label={t("designSystem.primaryButton")}
              icon={<CheckCircle size={18} color={onAccent} />}
            />
            <Button label={t("designSystem.secondaryButton")} variant="secondary" />
            <Button label={t("designSystem.dangerButton")} variant="danger" />
            <Button label={t("designSystem.ghostButton")} variant="ghost" />
          </View>
        </SettingsSection>

        <SettingsSection label={t("designSystem.cardsSection")}>
          <View className="p-4" style={{ gap: 12 }}>
            <Card>
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className="size-10 items-center justify-center rounded-icon">
                  <Wallet size={20} color={accentGreen} />
                </View>
                <View className="flex-1" style={{ gap: 2 }}>
                  <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
                    {t("designSystem.cardTitle")}
                  </Text>
                  <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
                    {t("designSystem.cardSubtitle")}
                  </Text>
                </View>
                <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
                  $840k
                </Text>
              </View>
            </Card>
            <Card>
              <View style={{ gap: 10 }}>
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Sparkles size={18} color={accentGreen} />
                  <Text className="font-poppins-semibold text-body text-primary dark:text-primary-dark">
                    {t("designSystem.calloutTitle")}
                  </Text>
                </View>
                <ProgressBar percent={68} />
              </View>
            </Card>
          </View>
        </SettingsSection>

        <SettingsSection label={t("designSystem.rowsSection")}>
          <View>
            <CatalogRow
              icon={<Bell size={22} color={secondary} />}
              title={t("designSystem.rowTitle")}
            />
            <CatalogRow
              icon={<Sparkles size={22} color={secondary} />}
              title={t("designSystem.rowWithSubtitle")}
              subtitle={t("designSystem.rowSubtitle")}
            />
          </View>
        </SettingsSection>
      </ScrollView>
    </ScreenLayout>
  );
}

function ColorSwatch({
  label,
  className,
  bordered = false,
}: {
  label: string;
  className: string;
  bordered?: boolean;
}) {
  return (
    <View className="flex-1" style={{ gap: 6 }}>
      <View
        className={`h-12 rounded-xl ${className} ${
          bordered ? "border border-border-subtle dark:border-border-subtle-dark" : ""
        }`}
      />
      <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
        {label}
      </Text>
    </View>
  );
}

function GlassSwatch({ label }: { label: string }) {
  return (
    <View className="flex-1" style={{ gap: 6 }}>
      <GlassSurface padded={false} radius={12} style={{ height: 48 }}>
        <View />
      </GlassSurface>
      <Text className="font-poppins-medium text-caption text-secondary dark:text-secondary-dark">
        {label}
      </Text>
    </View>
  );
}

function CatalogRow({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <Pressable className="flex-row items-center px-4 py-3" style={{ gap: 12 }}>
      {icon}
      <View className="flex-1" style={{ gap: 2 }}>
        <Text className="font-poppins text-body text-primary dark:text-primary-dark">{title}</Text>
        {subtitle ? (
          <Text className="font-poppins text-caption text-secondary dark:text-secondary-dark">
            {subtitle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
