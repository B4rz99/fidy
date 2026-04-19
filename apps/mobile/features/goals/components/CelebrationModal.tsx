import { memo } from "react";
import { Modal, Pressable, Text, View } from "@/shared/components/rn";
import { useThemeColor, useTranslation } from "@/shared/hooks";
import { formatMoney } from "@/shared/lib";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CelebrationMilestone = 25 | 50 | 75 | 100;

type CelebrationModalProps = {
  readonly visible: boolean;
  readonly milestone: CelebrationMilestone;
  readonly goalName: string;
  readonly currentAmount: number;
  readonly targetAmount: number;
  readonly onDismiss: () => void;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const milestoneI18nKey: Record<CelebrationMilestone, string> = {
  25: "goals.celebration.quarter",
  50: "goals.celebration.half",
  75: "goals.celebration.threeQuarter",
  100: "goals.celebration.complete",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CelebrationModal = memo(function CelebrationModal({
  visible,
  milestone,
  goalName,
  currentAmount,
  targetAmount,
  onDismiss,
}: CelebrationModalProps) {
  const { t } = useTranslation();
  const accentGreen = useThemeColor("accentGreen");
  const accentGreenLight = useThemeColor("accentGreenLight");
  const bgCard = useThemeColor("card");
  const textPrimary = useThemeColor("primary");
  const textSecondary = useThemeColor("secondary");

  const displayAmount = milestone === 100 ? targetAmount : currentAmount;
  const description =
    milestone === 100
      ? t("goals.celebration.descriptionComplete", { goalName })
      : t("goals.celebration.descriptionProgress", { goalName });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
          alignItems: "center",
          padding: 32,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 320,
            backgroundColor: bgCard,
            borderRadius: 24,
            padding: 32,
            alignItems: "center",
            gap: 20,
          }}
        >
          {/* Trophy icon circle */}
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: accentGreenLight,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 44 }}>{"🏆"}</Text>
          </View>

          {/* Title */}
          <Text
            style={{
              fontFamily: "Poppins_700Bold",
              fontSize: 22,
              color: textPrimary,
              textAlign: "center",
            }}
          >
            {t(milestoneI18nKey[milestone])}
          </Text>

          {/* Description */}
          <Text
            style={{
              fontFamily: "Poppins_500Medium",
              fontSize: 14,
              color: textSecondary,
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            {description}
          </Text>

          {/* Amount */}
          <Text
            style={{
              fontFamily: "Poppins_700Bold",
              fontSize: 24,
              color: accentGreen,
            }}
          >
            {formatMoney(displayAmount)}
          </Text>

          {/* Continue button */}
          <Pressable
            style={{
              width: "100%",
              height: 48,
              borderRadius: 12,
              backgroundColor: accentGreen,
              justifyContent: "center",
              alignItems: "center",
            }}
            onPress={onDismiss}
          >
            <Text
              style={{
                fontFamily: "Poppins_600SemiBold",
                fontSize: 16,
                color: "#FFFFFF",
              }}
            >
              {t("goals.celebration.continueButton")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
});
