export function getEntryTabTextStyle(input: {
  readonly activeColor: string;
  readonly isActive: boolean;
  readonly tertiary: string;
}) {
  return {
    color: input.isActive ? input.activeColor : input.tertiary,
    fontWeight: input.isActive ? "700" : "600",
  } as const;
}
