import { StyleSheet } from "@/shared/components/rn";

export const styles = StyleSheet.create({
  auroraLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(139, 195, 74, 0.04)",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 18,
  },
  headerAddButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(240, 240, 240, 0.1)",
  },
  headerTitle: {
    maxWidth: 250,
    fontFamily: "Poppins_700Bold",
    fontSize: 20,
  },
  introCopy: {
    fontFamily: "Poppins_700Bold",
    fontSize: 13,
    lineHeight: 19,
  },
  section: {
    gap: 10,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  sectionLabel: {
    fontFamily: "Poppins_800ExtraBold",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  sectionCount: {
    fontFamily: "Poppins_800ExtraBold",
    fontSize: 12,
  },
  accountCard: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  accountIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderCurve: "continuous",
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
    minHeight: 24,
    borderRadius: 999,
    borderCurve: "continuous",
    paddingHorizontal: 8,
    paddingVertical: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
});
