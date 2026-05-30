import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/shared/components";
import { ActivityIndicator, ScrollView, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { FLAG_KEYS, QA_PROFILES, QA_TARGET_LABEL_KEYS, QA_TARGET_LIST } from "./QaTools.constants";
import { styles } from "./QaTools.styles";
import { QaToolsCardButton } from "./QaToolsCardButton";
import { QaToolsSection } from "./QaToolsSection";
import type { QaToolsViewModel } from "./useQaToolsScreen";

type QaToolsContentProps = {
  readonly qaTools: QaToolsViewModel;
};

export function QaToolsContent({ qaTools }: QaToolsContentProps) {
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const primary = useThemeColor("primary");
  const secondary = useThemeColor("secondary");
  const borderSubtle = useThemeColor("borderSubtle");
  const card = useThemeColor("card");

  return (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { paddingBottom: bottom + 24 }]}
      contentInsetAdjustmentBehavior="automatic"
    >
      <View style={styles.statusBlock}>
        <Text style={[styles.subtitleText, { color: secondary }]}>{t("qaTools.subtitle")}</Text>
        <Text style={[styles.primaryValueText, { color: primary }]}>
          {qaTools.activeProfile
            ? t("qaTools.currentProfile", { profile: qaTools.activeProfile })
            : t("qaTools.noActiveProfile")}
        </Text>
        {qaTools.errorKey ? (
          <Text style={[styles.subtitleText, { color: "#C0392B" }]}>{t(qaTools.errorKey)}</Text>
        ) : null}
      </View>

      {qaTools.isPreparing ? (
        <View style={styles.centeredStatus}>
          <ActivityIndicator />
          <Text style={[styles.subtitleText, { color: secondary }]}>{t("qaTools.preparing")}</Text>
        </View>
      ) : null}

      <QaToolsSection title={t("qaTools.scenariosTitle")}>
        {QA_PROFILES.map((profile) => (
          <QaToolsCardButton
            key={profile}
            title={t(`qaTools.profiles.${profile}.title`)}
            description={t(`qaTools.profiles.${profile}.description`)}
            highlighted
            scenario
            onPress={() => {
              qaTools.onRunScenario(profile);
            }}
          />
        ))}
      </QaToolsSection>

      <QaToolsSection title={t("qaTools.flagsTitle")}>
        {FLAG_KEYS.map((flagName) => (
          <QaToolsCardButton
            key={flagName}
            title={t(`qaTools.flags.${flagName}.title`)}
            description={t(`qaTools.flags.${flagName}.description`)}
            statusLabel={qaTools.flags[flagName] ? t("qaTools.flagOn") : t("qaTools.flagOff")}
            highlighted={qaTools.flags[flagName]}
            onPress={() => {
              qaTools.onToggleFlag(flagName);
            }}
            testId={`qa.flag.${flagName}`}
          />
        ))}
      </QaToolsSection>

      <QaToolsSection title={t("qaTools.actionsTitle")}>
        {qaTools.activeProfile ? (
          <QaToolsCardButton
            title={t("qaTools.actions.resetCurrentScenario")}
            onPress={qaTools.onResetCurrentScenario}
            testId="qa.action.reset-current"
          />
        ) : null}
        <QaToolsCardButton
          title={t("qaTools.actions.resetFlags")}
          onPress={qaTools.onResetFlags}
          testId="qa.action.reset-flags"
        />
        <QaToolsCardButton
          title={t("qaTools.actions.clearLogs")}
          onPress={qaTools.onClearLogs}
          testId="qa.action.clear-logs"
        />
        <QaToolsCardButton
          title={t("qaTools.actions.clearNetwork")}
          onPress={qaTools.onClearNetworkEvents}
          testId="qa.action.clear-network-events"
        />
        {qaTools.activeProfile ? (
          <QaToolsCardButton
            title={t("qaTools.actions.exitLocalQa")}
            onPress={qaTools.onExitLocalQa}
            testId="qa.action.exit-local-qa"
          />
        ) : null}
      </QaToolsSection>

      <QaToolsSection title={t("qaTools.openTitle")}>
        {QA_TARGET_LIST.map((target) => (
          <QaToolsCardButton
            key={target}
            title={t(`qaTools.open.${QA_TARGET_LABEL_KEYS[target]}`)}
            onPress={() => {
              qaTools.onOpenTarget(target);
            }}
          />
        ))}
      </QaToolsSection>

      <QaToolsSection title={t("qaTools.logsTitle")}>
        {qaTools.logs.length === 0 ? (
          <Text style={[styles.cardDescription, { color: secondary }]}>
            {t("qaTools.logsEmpty")}
          </Text>
        ) : (
          qaTools.logs
            .slice()
            .reverse()
            .map((entry) => (
              <View
                key={entry.id}
                style={[styles.eventCard, { borderColor: borderSubtle, backgroundColor: card }]}
              >
                <Text style={[styles.eventTitle, { color: primary }]}>
                  {`${entry.level.toUpperCase()} · ${entry.message}`}
                </Text>
                <Text style={[styles.eventSubtitle, { color: secondary }]}>{entry.timestamp}</Text>
                {Object.keys(entry.context).length > 0 ? (
                  <Text style={[styles.eventSubtitle, { color: secondary }]}>
                    {JSON.stringify(entry.context)}
                  </Text>
                ) : null}
              </View>
            ))
        )}
      </QaToolsSection>

      <QaToolsSection title={t("qaTools.networkTitle")}>
        {qaTools.networkEvents.length === 0 ? (
          <Text style={[styles.cardDescription, { color: secondary }]}>
            {t("qaTools.networkEmpty")}
          </Text>
        ) : (
          qaTools.networkEvents
            .slice()
            .reverse()
            .map((event) => (
              <View
                key={event.id}
                style={[styles.eventCard, { borderColor: borderSubtle, backgroundColor: card }]}
              >
                <Text style={[styles.eventTitle, { color: primary }]}>
                  {`${event.method} · ${event.outcome.toUpperCase()}${event.status ? ` · ${event.status}` : ""}`}
                </Text>
                <Text style={[styles.eventSubtitle, { color: secondary }]}>{event.url}</Text>
              </View>
            ))
        )}
      </QaToolsSection>

      {qaTools.activeProfile ? (
        <Button
          label={t("qaTools.openWithCurrentProfile")}
          onPress={qaTools.onOpenCurrentProfileTarget}
        />
      ) : null}
    </ScrollView>
  );
}
