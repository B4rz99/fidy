import { StyleSheet } from "@/shared/components/rn";

export const styles = StyleSheet.create({
  centeredContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 24,
  },
  statusBlock: {
    gap: 8,
  },
  centeredStatus: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 8,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 16,
  },
  subtitleText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },
  primaryValueText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
  statusLabelText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 11,
  },
  cardButton: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  scenarioButton: {
    borderRadius: 18,
    gap: 4,
  },
  cardTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
  cardDescription: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  eventCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  eventTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 12,
  },
  eventSubtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
  },
  primaryButton: {
    borderRadius: 16,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: "#FFFFFF",
  },
});
