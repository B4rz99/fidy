import React, { useCallback } from "react";
import type { LucideIcon } from "@/shared/components/icons";
import {
  ArrowLeftRight,
  BarChart3,
  Car,
  ChevronRight,
  Clapperboard,
  X as CloseIcon,
  Ellipsis,
  GraduationCap,
  HeartPulse,
  House,
  PiggyBank,
  Shirt,
  Target,
  TrendingUp,
  TriangleAlert,
  Trophy,
  Utensils,
  Wrench,
} from "@/shared/components/icons";
import { Pressable, StyleSheet, Text, View } from "@/shared/components/rn";
import { useThemeColor } from "@/shared/hooks";
import type { NotificationDisplay } from "../lib/types";

const ICON_MAP: Record<string, LucideIcon> = {
  "triangle-alert": TriangleAlert,
  "circle-x": CloseIcon,
  trophy: Trophy,
  utensils: Utensils,
  car: Car,
  clapperboard: Clapperboard,
  "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap,
  house: House,
  shirt: Shirt,
  wrench: Wrench,
  "arrow-left-right": ArrowLeftRight,
  ellipsis: Ellipsis,
  "trending-up": TrendingUp,
  "piggy-bank": PiggyBank,
  "bar-chart-3": BarChart3,
  target: Target,
};

function formatRelativeTime(createdAt: string, now: Date): string {
  const diff = now.getTime() - new Date(createdAt).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

type NotificationCardProps = {
  readonly notification: NotificationDisplay;
  readonly onPress: (route: string) => void;
};

export const NotificationCard = React.memo(function NotificationCard({
  notification,
  onPress,
}: NotificationCardProps) {
  const primaryColor = useThemeColor("primary");
  const secondaryColor = useThemeColor("secondary");
  const tertiaryColor = useThemeColor("tertiary");
  const cardColor = useThemeColor("card");

  const IconComponent = ICON_MAP[notification.iconName] ?? TriangleAlert;

  const relativeTime = formatRelativeTime(notification.createdAt, new Date());

  const handlePress = useCallback(() => {
    if (notification.route) {
      onPress(notification.route);
    }
  }, [notification.route, onPress]);

  return (
    <Pressable
      onPress={notification.route ? handlePress : undefined}
      disabled={!notification.route}
      style={[styles.container, { backgroundColor: cardColor }]}
    >
      <View style={[styles.iconCircle, { backgroundColor: notification.iconBgColor }]}>
        <IconComponent size={16} color={notification.iconColor} />
      </View>

      <View style={styles.textColumn}>
        <Text style={[styles.title, { color: primaryColor }]} numberOfLines={1}>
          {notification.title}
        </Text>
        <Text style={[styles.message, { color: secondaryColor }]} numberOfLines={2}>
          {notification.message}
        </Text>
      </View>

      <View style={styles.rightColumn}>
        <Text style={[styles.timestamp, { color: tertiaryColor }]}>{relativeTime}</Text>
        {notification.route ? <ChevronRight size={14} color={tertiaryColor} /> : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
    borderRadius: 16,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
  message: {
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
  },
  rightColumn: {
    alignItems: "flex-end",
    gap: 4,
  },
  timestamp: {
    fontFamily: "Poppins_400Regular",
    fontSize: 11,
  },
});
