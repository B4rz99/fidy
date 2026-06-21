import { StyleSheet } from "@/shared/components/rn";

export const styles = StyleSheet.create({
  accountChip: {
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  amountZone: {
    alignItems: "center",
  },
  amountBanner: {
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 220,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  closeButtonContainer: {
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  closeButton: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  dateChip: {
    alignItems: "center",
    borderRadius: 10,
    flexDirection: "row",
    gap: 6,
    height: 36,
    paddingHorizontal: 10,
  },
  datePressable: {
    height: 36,
  },
  descriptionInput: {
    borderRadius: 10,
    flex: 1,
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    height: 36,
    paddingHorizontal: 12,
  },
  headerCenter: {
    alignItems: "center",
    gap: 4,
  },
  typeTabs: {
    width: "100%",
  },
  headerZone: {
    gap: 12,
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  label: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  metadataRow: {
    flexDirection: "row",
    gap: 8,
  },
  pillGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
  },
  pillSection: {
    alignItems: "center",
    gap: 6,
  },
  accountRow: {
    flexDirection: "row",
    gap: 8,
  },
});
