import { StyleSheet } from "@/shared/components/rn";

export const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: 24,
    gap: 16,
  },
  title: {
    fontFamily: "Poppins_700Bold",
    fontSize: 18,
  },
  formGrid: {
    gap: 12,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
  input: {
    borderRadius: 10,
    borderCurve: "continuous",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "Poppins_500Medium",
    fontSize: 14,
    minHeight: 44,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    borderRadius: 8,
    borderCurve: "continuous",
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 44,
    justifyContent: "center",
  },
  chipText: {
    fontFamily: "Poppins_500Medium",
    fontSize: 12,
  },
});
