import { StyleSheet } from "@/shared/components/rn";

export const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 18,
  },
  heroCard: {
    borderRadius: 22,
    padding: 18,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  heroText: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 21,
  },
  heroSubtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontFamily: "Poppins_700Bold",
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
  },
  fieldRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  fieldText: {
    flex: 1,
    gap: 4,
  },
  fieldLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
  },
  fieldValue: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
  identifierWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  identifierChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  identifierChipText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  emptyIdentifiers: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  manageButton: {
    minHeight: 46,
    paddingHorizontal: 16,
    justifyContent: "space-between",
  },
  manageButtonText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
});
