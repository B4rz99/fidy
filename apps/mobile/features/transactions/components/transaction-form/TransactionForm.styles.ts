import { StyleSheet } from "@/shared/components/rn";

export const styles = StyleSheet.create({
  accountChip: {
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  closeButtonContainer: {
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  container: {},
  dateChip: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    height: 36,
    paddingHorizontal: 10,
  },
  descriptionInput: {
    borderRadius: 10,
    borderWidth: 1,
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
  headerZone: {
    gap: 12,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  label: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  metadataRow: {
    flexDirection: "row",
    gap: 8,
  },
  amountCursor: {
    borderRadius: 1,
    height: 32,
    marginLeft: 2,
    width: 2,
  },
  amountDisplay: {
    fontFamily: "Poppins_700Bold",
    fontSize: 40,
  },
  amountRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
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
  bottomZone: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
