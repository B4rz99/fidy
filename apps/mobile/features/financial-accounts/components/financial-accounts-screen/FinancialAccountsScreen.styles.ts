import { StyleSheet } from "@/shared/components/rn";

export const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 20,
  },
  subtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    lineHeight: 19,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontFamily: "Poppins_700Bold",
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  row: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: {
    flex: 1,
    gap: 3,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  rowTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
  },
  rowSubtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  rowWarning: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 40,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
  },
});
