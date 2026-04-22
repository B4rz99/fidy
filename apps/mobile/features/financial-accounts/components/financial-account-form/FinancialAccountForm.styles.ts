import { StyleSheet } from "@/shared/components/rn";

export const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 18,
  },
  stateContainer: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  stateTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center",
  },
  stateBody: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  stateButton: {
    minWidth: 180,
  },
  subtitle: {
    fontFamily: "Poppins_500Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
  },
  card: {
    borderRadius: 18,
    padding: 16,
    gap: 16,
  },
  fieldBlock: {
    gap: 8,
  },
  fieldLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
  helperText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    lineHeight: 18,
  },
  kindWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  kindChip: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    justifyContent: "center",
  },
  kindChipText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
  },
  noteBanner: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noteText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
    lineHeight: 18,
  },
  identifierWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
  identifierEmpty: {
    paddingTop: 4,
  },
  manageButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  manageButtonText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 13,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
  },
});
