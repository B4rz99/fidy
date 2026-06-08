import { StyleSheet } from "@/shared/components/rn";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 32,
  },
  heroSection: {
    alignItems: "center",
    gap: 8,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  currentAmount: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
  },
  amountDivider: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
  targetAmount: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
  ringContainer: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  ringText: {
    position: "absolute",
    fontFamily: "Poppins_800ExtraBold",
    fontSize: 20,
  },
  projectionCard: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  projectionCardDashed: {
    borderStyle: "dashed",
  },
  projectionText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
    textAlign: "center",
  },
  tabContainer: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    borderCurve: "continuous",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingVertical: 8,
    borderCurve: "continuous",
  },
  tabText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
  tabContent: {
    gap: 12,
  },
  sectionTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
  },
  contributionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  contributionInfo: {
    flex: 1,
    gap: 2,
  },
  contributionDate: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },
  contributionNote: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
  },
  contributionAmount: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
  contributionRunning: {
    fontFamily: "Poppins_500Medium",
    fontSize: 11,
    marginLeft: 8,
  },
  recommendationCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 16,
    padding: 16,
    borderCurve: "continuous",
  },
  recommendationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  recommendationContent: {
    flex: 1,
    gap: 4,
  },
  recommendationTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
  recommendationBody: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    lineHeight: 20,
  },
  milestoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  milestoneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  milestoneContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  milestoneMonth: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },
  milestoneAmount: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
  },
  editHeaderButton: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 15,
  },
});
